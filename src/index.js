import React, { Component, PropTypes } from 'react' // eslint-disable-line import/no-unresolved
import shallowequal from 'shallowequal'
import raf from 'raf'
import shouldUpdate from './shouldUpdate'

const noop = () => {}

export default class Headroom extends Component {
  static propTypes = {
    parent: PropTypes.func,
    children: PropTypes.any.isRequired,
    disableInlineStyles: PropTypes.bool,
    disable: PropTypes.bool,
    upTolerance: PropTypes.number,
    downTolerance: PropTypes.number,
    onPin: PropTypes.func,
    onUnpin: PropTypes.func,
    onUnfix: PropTypes.func,
    wrapperStyle: PropTypes.object,
    pinStart: PropTypes.number,
    style: PropTypes.object,
    multipleStrategy: PropTypes.string,
  };

  static defaultProps = {
    parent: () => window,
    disableInlineStyles: false,
    disable: false,
    upTolerance: 5,
    downTolerance: 0,
    onPin: noop,
    onUnpin: noop,
    onUnfix: noop,
    wrapperStyle: {},
    pinStart: 0,
    multipleStrategy: 'none',
  };

  constructor (props) {
    super(props)
    // Class variables.
    this.currentScrollY = 0
    this.lastKnownScrollY = 0
    this.ticking = false
    this.state = {
      state: 'unfixed',
      translateY: 0,
      className: 'headroom headroom--unfixed',
    }
  }

  componentDidMount () {
    this.setHeightOffset()
    if (!this.props.disable) {
      this.props.parent().addEventListener('scroll', this.handleScroll)
    }
  }

  componentWillReceiveProps (nextProps) {
    if (nextProps.disable && !this.props.disable) {
      this.unfix()
      this.props.parent().removeEventListener('scroll', this.handleScroll)
    } else if (!nextProps.disable && this.props.disable) {
      this.props.parent().addEventListener('scroll', this.handleScroll)
    }
  }

  shouldComponentUpdate (nextProps, nextState) {
    return (
      !shallowequal(this.props, nextProps) ||
      !shallowequal(this.state, nextState)
    )
  }

  componentDidUpdate (prevProps) {
    // If children have changed, remeasure height.
    if (prevProps.children !== this.props.children) {
      this.setHeightOffset()
    }

    // updates pinned headrooms for override multiple strategy
    this.updatePinnedHeadrooms()
  }

  componentWillUnmount () {
    this.props.parent().removeEventListener('scroll', this.handleScroll)
    window.removeEventListener('scroll', this.handleScroll)
  }

  setHeightOffset = () => {
    this.setState({
      height: this.refs.inner.offsetHeight,
    })
  }

  getScrollY = () => {
    if (this.props.parent().pageYOffset !== undefined) {
      return this.props.parent().pageYOffset
    } else if (this.props.parent().scrollTop !== undefined) {
      return this.props.parent().scrollTop
    } else {
      return (document.documentElement || document.body.parentNode || document.body).scrollTop
    }
  }

  getViewportHeight = () => (
    window.innerHeight
      || document.documentElement.clientHeight
      || document.body.clientHeight
  )

  getDocumentHeight = () => {
    const body = document.body
    const documentElement = document.documentElement

    return Math.max(
      body.scrollHeight, documentElement.scrollHeight,
      body.offsetHeight, documentElement.offsetHeight,
      body.clientHeight, documentElement.clientHeight
    )
  }

  getElementPhysicalHeight = elm => Math.max(
    elm.offsetHeight,
    elm.clientHeight
  )

  getElementHeight = elm => Math.max(
    elm.scrollHeight,
    elm.offsetHeight,
    elm.clientHeight,
  )

  getScrollerPhysicalHeight = () => {
    const parent = this.props.parent()

    return (parent === window || parent === document.body)
      ? this.getViewportHeight()
      : this.getElementPhysicalHeight(parent)
  }

  getScrollerHeight = () => {
    const parent = this.props.parent()

    return (parent === window || parent === document.body)
      ? this.getDocumentHeight()
      : this.getElementHeight(parent)
  }

  updatePinnedHeadrooms = () => {
    if (this.props.multipleStrategy === 'override') {
      const headrooms = document.getElementsByClassName('headroom')
      // resets all headroom component states from previous component updates
      for (let i = 0; i < headrooms.length; i += 1) {
        // removes transition for smooth change of overridding headroom with overridden one
        headrooms[i].style.transition = 'none'
        // keep unpinned headrooms away
        if (headrooms[i].classList.contains('headroom--unpinned')) {
          headrooms[i].style.transform = 'translateY(-100%)'
        } else if (headrooms[i].classList.contains('headroom--pinned')) {
          headrooms[i].style.transform = 'translateY(0)'
        } else { // unfixed
          headrooms[i].style.transform = 'translateY(0)'
        }
      }
      // fetches pinned headrooms only
      const pinnedHeadrooms = document.getElementsByClassName('headroom--pinned')
      if (pinnedHeadrooms.length > 1) {
        // hides all pinned headrooms
        for (let j = 0; j <= pinnedHeadrooms.length - 1; j += 1) {
          const pinnedHeadroom = pinnedHeadrooms[j]
          pinnedHeadroom.style.transform = 'translateY(-100%)'
        }
        // bring back the last pinned headroom back to pinned position
        pinnedHeadrooms[pinnedHeadrooms.length - 1].style.transform = 'translateY(0)'
        // TODO should we add transitions back or may be we can handle it with prop
        // pinnedHeadrooms[pinnedHeadrooms.length - 1].style.transition = 'all .2s ease-in-out'
      }
    }
  }

  isOutOfBound = (currentScrollY) => {
    const pastTop = currentScrollY < 0

    const scrollerPhysicalHeight = this.getScrollerPhysicalHeight()
    const scrollerHeight = this.getScrollerHeight()

    const pastBottom = currentScrollY + scrollerPhysicalHeight > scrollerHeight

    return pastTop || pastBottom
  }

  handleScroll = () => {
    if (!this.ticking) {
      this.ticking = true
      raf(this.update)
    }
  }

  unpin = () => {
    this.props.onUnpin()

    this.setState({
      translateY: '-100%',
      className: 'headroom headroom--unpinned',
    }, () => {
      setTimeout(() => {
        this.setState({ state: 'unpinned' })
      }, 0)
    })
  }

  pin = () => {
    this.props.onPin()

    this.setState({
      translateY: 0,
      className: 'headroom headroom--pinned',
      state: 'pinned',
    })
  }

  unfix = () => {
    this.props.onUnfix()

    this.setState({
      translateY: 0,
      className: 'headroom headroom--unfixed',
      state: 'unfixed',
    })
  }

  update = () => {
    this.currentScrollY = this.getScrollY()

    if (!this.isOutOfBound(this.currentScrollY)) {
      const { action } = shouldUpdate(
        this.lastKnownScrollY,
        this.currentScrollY,
        this.props,
        this.state
      )

      if (action === 'pin') {
        this.pin()
      } else if (action === 'unpin') {
        this.unpin()
      } else if (action === 'unfix') {
        this.unfix()
      }
    }

    this.lastKnownScrollY = this.currentScrollY
    this.ticking = false
  }

  /**
   * Calculates top for `stack` strategy for handling multiple headrooms
   */
  calculateTop = () => {
    let top = 0
    if (this.props.multipleStrategy === 'none') return top

    const allHeadrooms = document.getElementsByClassName('headroom-wrapper')
    const totalHeadrooms = allHeadrooms.length
    let currentHeadroomIdx = -1
    for (let i = 0; i < allHeadrooms.length; i += 1) {
      if (allHeadrooms[i] === this.refs.headroomWrapper) {
        currentHeadroomIdx = i
        break
      }
    }
    if (this.props.multipleStrategy === 'stack') {
      if (totalHeadrooms > 1) {
        const lastHeadroomIdx = currentHeadroomIdx >= 0 ? currentHeadroomIdx : totalHeadrooms - 1
        for (let j = 1; j <= lastHeadroomIdx; j += 1) {
          const prevHeadroom = allHeadrooms[j - 1]
          top += prevHeadroom.getBoundingClientRect().height
        }
      }
    }
    return top
  }

  render () {
    const { ...divProps } = this.props
    delete divProps.onUnpin
    delete divProps.onPin
    delete divProps.onUnfix
    delete divProps.disableInlineStyles
    delete divProps.disable
    delete divProps.parent
    delete divProps.children
    delete divProps.upTolerance
    delete divProps.downTolerance
    delete divProps.pinStart
    delete divProps.multipleStrategy

    const { style, wrapperStyle, ...rest } = divProps

    const top = this.calculateTop()

    let innerStyle = {
      position: this.props.disable || this.state.state === 'unfixed' ? 'relative' : 'fixed',
      top: this.state.className.indexOf('--pinned') !== -1 ? top : 0,
      left: 0,
      right: 0,
      zIndex: 1,
      WebkitTransform: `translateY(${this.state.translateY})`,
      MsTransform: `translateY(${this.state.translateY})`,
      transform: `translateY(${this.state.translateY})`,
    }

    let className = this.state.className

    // Don't add css transitions until after we've done the initial
    // negative transform when transitioning from 'unfixed' to 'unpinned'.
    // If we don't do this, the header will flash into view temporarily
    // while it transitions from 0 — -100%.
    if (this.state.state !== 'unfixed') {
      innerStyle = {
        ...innerStyle,
        WebkitTransition: 'all .2s ease-in-out',
        MozTransition: 'all .2s ease-in-out',
        OTransition: 'all .2s ease-in-out',
        transition: 'all .2s ease-in-out',
      }
      className += ' headroom--scrolled'
    }

    if (!this.props.disableInlineStyles) {
      innerStyle = {
        ...innerStyle,
        ...style,
      }
    } else {
      innerStyle = style
    }

    const wrapperStyles = {
      ...wrapperStyle,
      height: this.state.height ? this.state.height : null,
    }

    return (
      <div style={wrapperStyles} className="headroom-wrapper" ref="headroomWrapper">
        <div
          ref="inner"
          {...rest}
          style={innerStyle}
          className={className}
        >
          {this.props.children}
        </div>
      </div>
    )
  }
}

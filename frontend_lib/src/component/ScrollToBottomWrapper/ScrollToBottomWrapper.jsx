import React from 'react'
import PropTypes from 'prop-types'

/*
 * DOC - SG - 2021-04-08
 * This component keeps the scroll position of its root element at the bottom as long as
 * it hasn't been scrolled manually away from the bottom.
 */
export class ScrollToBottomWrapper extends React.Component {
  constructor (props) {
    super(props)
    this.ref = React.createRef()
    if (props.forceScollToBottomHandler) {
      props.forceScollToBottomHandler(this.forceScrollToBottom)
    }
  }

  forceScrollToBottom = () => {
    if (this.ref.current) {
      this.ref.current.scrollTop = this.ref.current.scrollHeight
    }
  }

  render () {
    const { props } = this

    let className = 'scrollToBottomWrapper'
    if (props.customClass) {
      className += ' ' + props.customClass
    }

    return (
      <div
        className={className}
        ref={this.ref}
        style={{ overflow: 'auto', display: 'flex', flexDirection: 'column-reverse' }}
      >
        <div
          className='ScrollToBottomContents'
          style={{ flex: '1' }}
        >
          {props.children}
        </div>
      </div>
    )
  }
}

export default ScrollToBottomWrapper

ScrollToBottomWrapper.propTypes = {
  customClass: PropTypes.string,
  forceScollToBottomHandler: PropTypes.func
}

ScrollToBottomWrapper.defaultProps = {
  customClass: '',
  forceScollToBottomHandler: null
}

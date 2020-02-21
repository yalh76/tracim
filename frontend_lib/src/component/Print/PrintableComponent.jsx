import React from 'react'

class PrintableComponent extends React.Component {
  render () {
    return (
      <div dangerouslySetInnerHTML={{ __html: this.props.text }} />
    )
  }
}

export default PrintableComponent

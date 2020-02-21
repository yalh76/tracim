import React from 'react'
import ReactDOM from 'react-dom'
import PrintButton from './PrintButton.jsx'
import ReactToPrint from 'react-to-print'
import PrintableComponent from './PrintableComponent'

class Print extends React.Component {
  getPrintableContent = () => {
    const printRef = React.createRef();
    const printComponent = React.createElement(PrintableComponent, { text: this.props.content, ref: printRef });
    ReactDOM.render(printComponent, document.getElementById('printElement'))
    return printRef.current
  }

  render () {
    const { props } = this

    return (
      <>
        <ReactToPrint
          trigger={() => <PrintButton config={props.hexcolor} />}
          pageStyle={require('./print.styl')}
          content={this.getPrintableContent}
        />

        <div id='printElement' style={{display: 'none'}} />
      </>
    )
  }
}

export default Print

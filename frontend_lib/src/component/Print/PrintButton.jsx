import { translate } from 'react-i18next'
import Radium from 'radium'
import React from 'react'

const PrintButton = props => {
  const styleColorPrintBtn = {
    backgroundColor: '#fdfdfd',
    color: '#333',
    ':hover': {
      color: props.hexcolor
    }
  }

  return (
    <div className='html-document__header__print'>
      <button
        type='button'
        className='html-document__header__print__button btn iconBtn'
        title={props.t('Print')}
        style={styleColorPrintBtn}
        onClick={props.onClick}
      >
        <i className='fa fa-fw fa-print' />
      </button>
    </div>
  )
}

export default translate()(Radium(PrintButton))

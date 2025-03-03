import React from 'react'
import PropTypes from 'prop-types'
import classnames from 'classnames'
import DropdownMenuItem from './DropdownMenuItem.jsx'

const DropdownMenu = props => {
  return (
    <div className='dropdown'>
      <button
        aria-expanded='false'
        aria-haspopup='true'
        className={classnames(
          'btn dropdown-toggle',
          'dropdownMenuButton',
          props.isButton ? 'primaryColorBorder' : 'transparentButton',
          props.buttonCustomClass
        )}
        data-cy={props.buttonDataCy}
        data-toggle='dropdown'
        disabled={props.buttonDisabled}
        onClick={e => { e.stopPropagation(); props.buttonClick() }}
        title={props.buttonTooltip ? props.buttonTooltip : ((typeof props.buttonLabel) === 'string' ? props.buttonLabel : undefined)}
        type='button'
      >
        {props.buttonOpts}
        {props.buttonIcon && <i className={`fa-fw ${props.buttonIcon}`} style={{ color: props.buttonIconColor }} />}
        {props.buttonLabel && <span>{props.buttonLabel}</span>}
      </button>

      <div
        aria-labelledby='dropdownMenuButton'
        className={classnames('dropdownMenu dropdown-menu', props.menuCustomClass)}
        data-cy='dropdownMenu_items'
      >
        {(props.children.length > 1
          ? props.children.map(child => child && <DropdownMenuItem key={child.key} customClass={props.itemCustomClass}> {child} </DropdownMenuItem>)
          : <DropdownMenuItem customClass={props.itemCustomClass}> {props.children} </DropdownMenuItem>
        )}
      </div>
    </div>
  )
}

export default DropdownMenu

DropdownMenu.propTypes = {
  buttonClick: PropTypes.func,
  buttonCustomClass: PropTypes.string,
  buttonDataCy: PropTypes.string,
  buttonDisabled: PropTypes.bool,
  buttonIcon: PropTypes.string,
  buttonIconColor: PropTypes.string,
  buttonLabel: PropTypes.string,
  buttonOpts: PropTypes.node,
  buttonTooltip: PropTypes.string,
  itemCustomClass: PropTypes.string,
  menuCustomClass: PropTypes.string,
  isButton: PropTypes.bool
}

DropdownMenu.defaultProps = {
  buttonClick: () => { },
  buttonCustomClass: '',
  buttonDataCy: '',
  buttonDisabled: false,
  buttonIcon: '',
  buttonIconColor: '',
  buttonLabel: '',
  buttonTooltip: '',
  menuCustomClass: '',
  itemCustomClass: '',
  isButton: false
}

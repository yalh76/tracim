import React from 'react'
import PropTypes from 'prop-types'
import { translate } from 'react-i18next'
import { ROLE } from 'tracim_frontend_lib'
import { connect } from 'react-redux'
import { PAGE } from '../../helper'
import { Link } from 'react-router-dom'

function menuItem (props, action, icon) {
  console.log(action, props.onClickExtendedAction[action])
  return props.onClickExtendedAction[action] && props.userRoleIdInWorkspace >= props.onClickExtendedAction[action].allowedRoleId && (
    <div
      className='subdropdown__item primaryColorBgLightenHover dropdown-item d-flex align-items-center'
      onClick={props.onClickExtendedAction[action].callback}
      data-cy='extended_action_edit'
    >
      <div className='subdropdown__item__icon mr-3'>
        <i className={'fa fa-fw fa-' + icon} />
      </div>

      <div className='subdropdown__item__text'>
        {props.onClickExtendedAction[action].label}
      </div>
    </div>
  )
}

export const ExtendedAction = props => {
  return (
    <div
      className='extendedaction dropdown'
      data-cy='extended_action'
    >
      <button
        className='extendedaction__button btn outlineTextBtn primaryColorBorder primaryColorBgHover primaryColorBorderDarkenHover dropdown-toggle'
        type='button'
        id='dropdownMenuButton'
        data-toggle='dropdown'
        aria-haspopup='true'
        aria-expanded='false'
        onClick={e => e.stopPropagation()}
      >
        <i className='fa fa-fw fa-ellipsis-h' />
      </button>

      <div className='extendedaction__subdropdown dropdown-menu' aria-labelledby='dropdownMenuButton'>
        {menuItem(props, 'open', 'folder-open')}
        {menuItem(props, 'edit', 'pencil')}
        {menuItem(props, 'rename', 'i-cursor')}
        {menuItem(props, 'delete', 'trash-o')}
        {menuItem(props, 'share', 'share')}
        {menuItem(props, 'download', 'download')}

        {/* INFO - G.B. - 2019-09-06 - For now, we decide to hide the archive function - https://github.com/tracim/tracim/issues/2347
        {menuItem(props, 'archive', 'archive')} */}

        {/* FIXME - GM - 2019-04-16 - Don't use hardcoded slug and find a better way to handle app buttons like this one - https://github.com/tracim/tracim/issues/2654 */}
        {props.folderData && props.appList && props.appList.some((app) => app.slug === 'gallery') && (
          <Link
            className='subdropdown__item primaryColorBgLightenHover dropdown-item d-flex align-items-center'
            onClick={e => e.stopPropagation()}
            data-cy='extended_action_gallery'
            to={`${PAGE.WORKSPACE.GALLERY(props.folderData.workspaceId)}?folder_ids=${props.folderData.id}`}
          >
            <div className='subdropdown__item__icon mr-3'>
              <i className='fa fa-fw fa-picture-o' />
            </div>

            <div className='subdropdown__item__text'>
              {props.t('Gallery')}
            </div>
          </Link>
        )}
      </div>
    </div>
  )
}

const mapStateToProps = ({ appList }) => ({
  appList
})

export default connect(mapStateToProps)(translate()(ExtendedAction))

ExtendedAction.propTypes = {
  onClickExtendedAction: PropTypes.object.isRequired,
  userRoleIdInWorkspace: PropTypes.number
}

ExtendedAction.defaultProps = {
  userRoleIdInWorkspace: ROLE.reader.id
}

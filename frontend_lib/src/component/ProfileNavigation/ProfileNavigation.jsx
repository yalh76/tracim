import React from 'react'
import { translate } from 'react-i18next'
import PropTypes from 'prop-types'
import { Link } from 'react-router-dom'
import { PAGE } from '../../helper.js'
import { Popover, PopoverBody } from 'reactstrap'
import { isMobile } from 'react-device-detect'
// import { debug } from '../../debug.js'

// export class ProfileNavigation extends React.Component {

  // constructor (props) {
  //   super(props)

  //   const param = props.data || debug

  //   this.state = {
  //     // appName: 'workspace',
  //     // allowedTypes: [],
  //     // config: param.config,
  //     // isFirstStep: true,
  //     // loggedUser: param.loggedUser,
  //     // newDefaultRole: '',
  //     // newParentSpace: {
  //     //   value: props.t('None'),
  //     //   label: props.t('None'),
  //     //   parentId: null,
  //     //   spaceId: null
  //     // },
  //     // newType: '',
  //     // newName: '',
  //     // parentOptions: [],
  //     // popoverDefaultRoleInfoOpen: false,
  //     showWarningMessage: false
  //   }
  // }

const ProfileNavigation = props => {
  // render () {
  //   const { props } = this

    return (
      <div>
        <Link
          className='profileNavigation'
          to={PAGE.PUBLIC_PROFILE(props.user.userId)}
          title={props.t("{{user}}'s profile", { user: props.user.publicName })}
        >
          {props.children}
        </Link>
        <Popover
          placement='bottom'
          // isOpen={state.popoverDefaultRoleInfoOpen}
          // target='popoverDefaultRoleInfo'
          // // INFO - GB - 2020-109 - ignoring rule react/jsx-handler-names for prop bellow because it comes from external lib
          // toggle={this.handleTogglePopoverDefaultRoleInfo} // eslint-disable-line react/jsx-handler-names
          trigger={isMobile ? 'focus' : 'hover'}
        >
          <PopoverBody>
            {props.t('This is the role that members will have by default when they join your space (for open and on request spaces only).')}

          <p>df</p>
          </PopoverBody>
        </Popover>
      </div>
    )
  // }
}

export default translate()(ProfileNavigation)

ProfileNavigation.propTypes = {
  user: PropTypes.object.isRequired
}

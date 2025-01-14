import React from 'react'
import { Link } from 'react-router-dom'
import PropTypes from 'prop-types'
import { translate } from 'react-i18next'
import { FETCH_CONFIG } from '../../../util/helper.js'
import { Avatar, AVATAR_SIZE, DropdownMenu, PAGE } from 'tracim_frontend_lib'
import { isMobile } from 'react-device-detect'

require('./MenuProfil.styl')

export const MenuProfil = props => {
  if (!props.user.logged) return null

  return (
    <li className='menuprofil'>
      <DropdownMenu
        buttonOpts={
          <Avatar
            size={AVATAR_SIZE.SMALL}
            user={props.user}
            apiUrl={FETCH_CONFIG.apiUrl}
            key='menuprofil__dropdown__avatar'
          />
        }
        buttonLabel={props.user.publicName}
        buttonCustomClass='menuprofil__dropdown__name nohover'
        menuCustomClass='menuprofil__dropdown__setting'
        buttonDataCy='menuprofil__dropdown__button'
      >
        <Link
          to={PAGE.PUBLIC_PROFILE(props.user.userId)}
          data-cy='menuprofil__dropdown__profile__link'
          key='menuprofil__dropdown__profile__link'
        >
          <div
            data-toggle={isMobile ? 'collapse' : ''}
            data-target='#navbarSupportedContent'
            className='collapseNavbar'
          >
            <i className='far fa-fw fa-user' />
            {props.t('My profile')}
          </div>
        </Link>

        <Link
          to={PAGE.ACCOUNT}
          data-cy='menuprofil__dropdown__account__link'
          key='menuprofil__dropdown__account__link'
        >
          <div
            data-toggle={isMobile ? 'collapse' : ''}
            data-target='#navbarSupportedContent'
            className='collapseNavbar'
          >
            <i className='fas fa-fw fa-cogs' />
            {props.t('Account Settings')}
          </div>
        </Link>

        <button
          className='transparentButton'
          onClick={props.onClickLogout}
          data-cy='menuprofil__dropdown__logout__link'
          key='menuprofil__dropdown__logout__link'
          data-toggle={isMobile ? 'collapse' : ''}
          data-target='#navbarSupportedContent'
        >
          <i className='fas fa-fw fa-sign-out-alt' />
          {props.t('Log out')}
        </button>
      </DropdownMenu>
    </li>
  )
}
export default translate()(MenuProfil)

MenuProfil.propTypes = {
  user: PropTypes.object.isRequired,
  onClickLogout: PropTypes.func.isRequired
}

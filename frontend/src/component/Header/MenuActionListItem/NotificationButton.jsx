import React from 'react'
import { translate } from 'react-i18next'
import PropTypes from 'prop-types'
require('./NotificationButton.styl')

export const NotificationButton = props => {
  return (
    <div className='notificationButton'>
      <button
        className='notificationButton__btn btn outlineTextBtn nohover primaryColorBorder'
        type='button'
        style={{ fontWeight: props.unreadNotificationCount ? 'bold' : 'normal' }}
        onClick={props.onClickNotification}
      >
        <i className='far fa-fw fa-bell' />
        {props.t('Notifications')}
        {props.notificationNotReadCount > 0 && (
          <div
            className='notificationButton__count'
          >
            {props.notificationNotReadCount > 99 ? '99+' : props.notificationNotReadCount}
          </div>
        )}
      </button>
    </div>
  )
}
export default translate()(NotificationButton)

NotificationButton.propTypes = {
  unreadMentionCount: PropTypes.number,
  notificationNotReadCount: PropTypes.number,
  onClickNotification: PropTypes.func
}

NotificationButton.defaultProps = {
  unreadMentionCount: 0,
  notificationNotReadCount: 0,
  onClickNotification: () => {}
}

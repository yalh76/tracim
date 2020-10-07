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
        <i className='fa fa-fw fa-bell-o' />
        {props.t('Notifications')}
        {props.unreadMentionCount > 0 && (
          <div
            className='notificationButton__count'
          >
            {props.unreadMentionCount > 99 ? '99+' : props.unreadMentionCount}
          </div>
        )}
      </button>
    </div>
  )
}
export default translate()(NotificationButton)

NotificationButton.propTypes = {
  unreadMentionCount: PropTypes.number,
  unreadNotificationCount: PropTypes.number,
  onClickNotification: PropTypes.func
}

NotificationButton.defaultProps = {
  unreadMentionCount: 0,
  unreadNotificationCount: 0,
  onClickNotification: () => {}
}

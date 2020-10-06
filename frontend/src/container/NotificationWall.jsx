import React from 'react'
import { Link } from 'react-router-dom'
import { connect } from 'react-redux'
import classnames from 'classnames'
import { translate } from 'react-i18next'
import {
  getNotificationList,
  putAllNotificationAsRead,
  putNotificationAsRead
} from '../action-creator.async.js'
import {
  appendNotificationList,
  newFlashMessage,
  readNotification,
  readNotificationList,
  setNextPage
} from '../action-creator.sync.js'
import {
  CONTENT_TYPE,
  PROFILE,
  displayDistanceDate,
  GenericButton,
  ListItemWrapper,
  PopinFixedHeader,
  TLM_CORE_EVENT_TYPE as TLM_EVENT,
  TLM_ENTITY_TYPE as TLM_ENTITY,
  TLM_SUB_TYPE as TLM_SUB,
  NUMBER_RESULTS_BY_PAGE,
  TracimComponent,
  Avatar,
  ComposedIcon,
  formatAbsoluteDate
} from 'tracim_frontend_lib'
import {
  PAGE,
  ANCHOR_NAMESPACE
} from '../util/helper.js'

import { escape as escapeHtml } from 'lodash'

const getNotificationLabelAndId = (notification) => {
  if (!notification.content) {
    return ['', 0]
  }

  const [entityType, /* eventType */ , contentType] = notification.type.split('.')
  return ((contentType === TLM_SUB.COMMENT) || (entityType === TLM_ENTITY.MENTION && notification.content.type === CONTENT_TYPE.COMMENT))
    ? [notification.content.parentLabel, notification.content.parentId]
    : [notification.content.label, notification.content.id]
}

export class NotificationWall extends React.Component {
  constructor () {
    super()
    this.state = {
      unfoldedNotificationGroup: {}
    }
  }

  handleClickNotification = async (e, notificationId, notificationDetails, dontFollowLink = false) => {
    const { props } = this

    if (dontFollowLink) {
      e.preventDefault()
    } else if (!notificationDetails.url) {
      if (notificationDetails.emptyUrlMsg) {
        props.dispatch(newFlashMessage(notificationDetails.emptyUrlMsg, notificationDetails.msgType || 'warning'))
      }
      e.preventDefault()
    }

    const fetchPutNotificationAsRead = await props.dispatch(putNotificationAsRead(props.user.userId, notificationId))
    switch (fetchPutNotificationAsRead.status) {
      case 204: {
        props.dispatch(readNotification(notificationId))
        break
      }
      default:
        props.dispatch(newFlashMessage(props.t('Error while marking the notification as read'), 'warning'))
    }

    props.onCloseNotificationWall()
  }

  handleClickSeeMore = async () => {
    const { props } = this

    const fetchGetNotificationWall = await props.dispatch(getNotificationList(props.user.userId, NUMBER_RESULTS_BY_PAGE, props.notificationPage.nextPageToken))
    switch (fetchGetNotificationWall.status) {
      case 200:
        props.dispatch(appendNotificationList(fetchGetNotificationWall.json.items))
        props.dispatch(setNextPage(fetchGetNotificationWall.json.has_next, fetchGetNotificationWall.json.next_page_token))
        break
      default:
        props.dispatch(newFlashMessage(props.t('Error while loading the notification list'), 'warning'))
    }
  }

  getNotificationDetails = notification => {
    const { props } = this

    const [entityType, eventType, contentType] = notification.type.split('.')

    const escapedAuthor = escapeHtml(notification.author)
    const escapedUser = notification.user ? escapeHtml(notification.user.publicName) : ''

    const escapedContentLabel = escapeHtml(getNotificationLabelAndId(notification)[0])

    const escapedWorkspaceLabel = notification.workspace ? escapeHtml(notification.workspace.label) : ''

    const i18nOpts = {
      user: `<span title='${escapedUser}'>${escapedUser}</span>`,
      author: `<span title='${escapedAuthor}'>${escapedAuthor}</span>`,
      content: `<span title='${escapedContentLabel}'class='contentTitle__highlight'>${escapedContentLabel}</span>`,
      space: `<span title="${escapedWorkspaceLabel}" class='documentTitle__highlight'>${escapedWorkspaceLabel}</span>`,
      interpolation: { escapeValue: false }
    }

    const contentUrl = notification.content ? PAGE.WORKSPACE.CONTENT(notification.workspace.id, notification.content.type, notification.content.id) : ''

    if (entityType === TLM_ENTITY.CONTENT) {
      switch (eventType) {
        case TLM_EVENT.CREATED: {
          if (contentType === TLM_SUB.COMMENT) {
            return {
              icon: 'comments-o',
              text: props.t('{{author}} commented on {{content}} in {{space}}', i18nOpts),
              url: PAGE.WORKSPACE.CONTENT(notification.workspace.id, notification.content.parentContentType, notification.content.parentId)
            }
          }

          return {
            icon: 'magic',
            text: props.t('{{author}} created {{content}} in {{space}}', i18nOpts),
            url: contentUrl
          }
        }
        case TLM_EVENT.MODIFIED: {
          if (notification.content.currentRevisionType === 'status-update') {
            return {
              icon: 'random',
              text: props.t('{{author}} changed the status of {{content}} in {{space}}', i18nOpts),
              url: contentUrl
            }
          }

          return {
            icon: 'history',
            text: props.t('{{author}} updated {{content}} in {{space}}', i18nOpts),
            url: contentUrl
          }
        }
        case TLM_EVENT.DELETED: {
          return {
            icon: 'magic',
            text: props.t('{{author}} deleted {{content}} from {{space}}', i18nOpts),
            url: contentUrl
          }
        }
        case TLM_EVENT.UNDELETED: {
          return {
            icon: 'magic',
            text: props.t('{{author}} restored {{content}} in {{space}}', i18nOpts),
            url: contentUrl
          }
        }
      }
    }

    if (entityType === TLM_ENTITY.MENTION && eventType === TLM_EVENT.CREATED) {
      if (notification.content.type === CONTENT_TYPE.COMMENT) {
        return {
          icon: 'comment-o',
          text: props.t('{{author}} mentioned you in a comment in {{content}} in {{space}}', i18nOpts),
          url: PAGE.WORKSPACE.CONTENT(notification.workspace.id, notification.content.parentContentType, notification.content.parentId),
          isMention: true
        }
      }

      return {
        icon: 'at',
        text: props.t('{{author}} mentioned you in {{content}} in {{space}}', i18nOpts),
        url: contentUrl,
        isMention: true
      }
    }

    if (entityType === TLM_ENTITY.USER) {
      const details = {
        url: (props.user.profile === PROFILE.administrator.slug) ? PAGE.ADMIN.USER_EDIT(notification.user.userId) : '',
        emptyUrlMsg: props.t("Only an administrator can see this user's profile"),
        msgType: 'info'
      }

      switch (eventType) {
        case TLM_EVENT.CREATED: return {
          ...details,
          icon: 'user-plus',
          text: props.t("{{author}} created {{user}}'s profile", i18nOpts)
        }
        case TLM_EVENT.MODIFIED: return {
          ...details,
          icon: 'user+history',
          text: props.t("{{author}} modified {{user}}'s profile", i18nOpts)
        }
        case TLM_EVENT.DELETED: return {
          ...details,
          icon: 'user-times',
          text: props.t("{{author}} deleted {{user}}'s profile", i18nOpts)
        }
        case TLM_EVENT.UNDELETED: return {
          ...details,
          icon: 'user+undo',
          text: props.t("{{author}} restored {{user}}'s profile", i18nOpts)
        }
      }
    }

    const dashboardUrl = notification.workspace ? PAGE.WORKSPACE.DASHBOARD(notification.workspace.id) : ''

    if (entityType === TLM_ENTITY.SHAREDSPACE_MEMBER) {
      switch (eventType) {
        case TLM_EVENT.CREATED: return {
          icon: 'user-o+plus',
          text: props.user.userId === notification.user.userId
            ? props.t('{{author}} added you to {{space}}', i18nOpts)
            : props.t('{{author}} added {{user}} to {{space}}', i18nOpts),
          url: dashboardUrl
        }
        case TLM_EVENT.MODIFIED: return {
          icon: 'user-o+history',
          text: props.user.userId === notification.user.userId
            ? props.t('{{author}} added you to {{space}}', i18nOpts)
            : props.t('{{author}} added {{user}} to {{space}}', i18nOpts),
          url: dashboardUrl
        }
        case TLM_EVENT.DELETED: return {
          icon: 'user-o+times',
          text: props.user.userId === notification.user.userId
            ? props.t('{{author}} added you to {{space}}', i18nOpts)
            : props.t('{{author}} added {{user}} to {{space}}', i18nOpts),
          url: dashboardUrl
        }
      }
    }

    if (entityType === TLM_ENTITY.SHAREDSPACE) {
      switch (eventType) {
        case TLM_EVENT.CREATED: return {
          icon: 'university+plus',
          text: props.t('{{author}} created the space {{space}}', i18nOpts),
          url: dashboardUrl
        }
        case TLM_EVENT.MODIFIED: return {
          icon: 'university+history',
          text: props.t('{{author}} modified the space {{space}}', i18nOpts),
          url: dashboardUrl
        }
        case TLM_EVENT.DELETED: return {
          icon: 'university+times',
          text: props.t('{{author}} deleted the space {{space}}', i18nOpts),
          url: dashboardUrl
        }
        case TLM_EVENT.UNDELETED: return {
          icon: 'university+undo',
          text: props.t('{{author}} restored the space {{space}}', i18nOpts),
          url: dashboardUrl
        }
      }
    }

    return {
      icon: 'bell',
      text: `${notification.author} ${notification.type}`,
      url: contentUrl,
      emptyUrlMsg: props.t('This notification has no associated content'),
      msgType: 'warning'
    }
  }

  handleClickMarkAllAsRead = async () => {
    const { props } = this

    const fetchAllPutNotificationAsRead = await props.dispatch(putAllNotificationAsRead(props.user.userId))
    switch (fetchAllPutNotificationAsRead.status) {
      case 204:
        props.dispatch(readNotificationList())
        break
      default:
        props.dispatch(newFlashMessage(props.t('An error has happened while setting "mark all as read"'), 'warning'))
    }
  }

  toggleGroup (spaceId) {
    this.setState(prev => ({
      unfoldedNotificationGroup: { ...prev.unfoldedNotificationGroup, [spaceId]: !this.state.unfoldedNotificationGroup[spaceId] }
    }))
  }

  render () {
    const { props, state } = this

    if (!props.notificationPage.list) return null

    const notificationsGroupsByContentIdBySpaceId = {}
    for (const notification of props.notificationPage.list) {
      const spaceId = notification.workspace ? notification.workspace.id : '0'
      const byContent = (
        notificationsGroupsByContentIdBySpaceId[spaceId] || (
          notificationsGroupsByContentIdBySpaceId[spaceId] = {
            label: (
              notification.workspace
                ? notification.workspace.label
                : '(instance)'
            ),
            id: spaceId,
            byContent: {}
          }
        )
      ).byContent
      const [label, contentId] = (
        notification.content
          ? getNotificationLabelAndId(notification)
          : ['(space)', 0]
      )
      ;(
        byContent[contentId] || (
          byContent[contentId] = {
            label: label,
            id: contentId,
            list: []
          }
        )
      ).list.push(notification)
    }

    const notificationsGroupListByContentListBySpace = []
    for (const notificationsGroupsByContentId of Object.values(notificationsGroupsByContentIdBySpaceId)) {
      const notificationsGroupsByContent = []

      for (const notificationsGroup of Object.values(notificationsGroupsByContentId.byContent)) {
        notificationsGroupsByContent.push({
          list: notificationsGroup.list.sort(
            (a, b) => Number(b.id) - Number(a.id)
          ),
          id: notificationsGroup.id,
          label: notificationsGroup.label
        })
      }
      notificationsGroupsByContent.sort((groupA, groupB) => groupB.list[0].id - groupA.list[0].id)
      notificationsGroupListByContentListBySpace.push({
        id: notificationsGroupsByContentId.id,
        label: notificationsGroupsByContentId.label,
        list: notificationsGroupsByContent
      })
    }

    notificationsGroupListByContentListBySpace.sort(
      (groupOfGroupsA, groupOfGroupsB) => (
        groupOfGroupsB.list[0].list[0].id - groupOfGroupsA.list[0].list[0].id
      )
    )

    return (
      <div className={classnames('notification', { notification__wallClose: !props.isNotificationWallOpen })}>
        <PopinFixedHeader
          customClass='notification'
          faIcon='bell-o'
          rawTitle={props.t('Notifications')}
          componentTitle={<div>{props.t('Notifications')}</div>}
          onClickCloseBtn={props.onCloseNotificationWall}
        >
          <GenericButton
            customClass='btn outlineTextBtn primaryColorBorder primaryColorBgHover primaryColorBorderDarkenHover'
            onClick={this.handleClickMarkAllAsRead}
            label={props.t('Mark all as read')}
            faIcon='envelope-open-o'
            dataCy='markAllAsReadButton'
          />
        </PopinFixedHeader>

        <div className='notification__groups'>
          {notificationsGroupListByContentListBySpace.map(({ label: spaceName, id: workspaceId, list: contentList }) => {
            let spaceUnreadCount = 0
            for (const content of contentList) {
              spaceUnreadCount += content.list.filter(notification => !notification.read).length
            }

            return (
              <div className={'notification__group notification__group__' + (state.unfoldedNotificationGroup[workspaceId] ? 'un' : '') + 'folded'} key={spaceName}>
                <Link onClick={() => this.toggleGroup(workspaceId)}>
                  {spaceName}
                  {spaceUnreadCount ? <b>{' (' + spaceUnreadCount + ')'}</b> : ''}
                </Link>
                <div className='notification__groups'>
                  {contentList.map(({ label: contentName, id: contentId, list: notificationList }) => {
                    const contentUnreadCount = notificationList.filter(notification => !notification.read).length
                    const groupId = workspaceId + '.' + contentId
                    return (
                      <div className={'notification__group notification__group__' + (state.unfoldedNotificationGroup[groupId] ? 'un' : '') + 'folded'} key={contentId}>
                        <Link onClick={() => this.toggleGroup(groupId)}>
                          {contentName}
                          {contentUnreadCount ? <b>{' (' + contentUnreadCount + ')'}</b> : ''}
                        </Link>
                        <div className='notification__list'>
                          {notificationList.map((notification, i) => {
                            const notificationDetails = this.getNotificationDetails(notification)
                            const icons = notificationDetails.icon.split('+')
                            const icon = (
                              icons.length === 1
                                ? <i className={`fa fa-fw fa-${icons[0]}`} />
                                : <ComposedIcon mainIcon={icons[0]} smallIcon={icons[1]} />
                            )

                            return (
                              <ListItemWrapper
                                isLast={i === props.notificationPage.list.length - 1}
                                read={false}
                                id={`${ANCHOR_NAMESPACE.notificationItem}:${notification.id}`}
                                key={notification.id}
                              >
                                <Link
                                  to={notificationDetails.url || '#'}
                                  onClick={(e) => this.handleClickNotification(e, notification.id, notificationDetails)}
                                  className={
                                    classnames('notification__list__item', { itemRead: notification.read, isMention: notificationDetails.isMention })
                                  }
                                  key={notification.id}
                                >
                                  {icon}
                                  <div className='notification__list__item__text'>
                                    <Avatar publicName={notification.author} width={23} style={{ marginRight: '5px' }} />
                                    <span
                                      dangerouslySetInnerHTML={{
                                        __html: (
                                          notificationDetails.text + ' ' +
                                          `<span title='${escapeHtml(formatAbsoluteDate(notification.created, props.user.lang))}'>` +
                                            escapeHtml(displayDistanceDate(notification.created, props.user.lang)) +
                                          '</span>'
                                        )
                                      }}
                                    />
                                  </div>
                                  {!notification.read && <Link onClick={(e) => this.handleClickNotification(e, notification.id, notificationDetails, true)} className='notification__list__item__circle fa fa-circle' />}
                                </Link>
                              </ListItemWrapper>
                            )
                          })}
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            )
          })}
        </div>
        {(props.notificationPage.hasNextPage &&
          <div className='notification__footer'>
            <GenericButton
              customClass='btn outlineTextBtn primaryColorBorder primaryColorBgHover primaryColorBorderDarkenHover'
              onClick={this.handleClickSeeMore}
              label={props.t('See more')}
              faIcon='chevron-down'
            />
          </div>
        )}
      </div>
    )
  }
}

const mapStateToProps = ({ user, notificationPage }) => ({ user, notificationPage })
export default connect(mapStateToProps)(translate()(TracimComponent(NotificationWall)))

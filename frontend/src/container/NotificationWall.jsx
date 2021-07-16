import React from 'react'
import { Link } from 'react-router-dom'
import { connect } from 'react-redux'
import classnames from 'classnames'
import { translate } from 'react-i18next'
import {
  getNotificationList,
  putAllNotificationAsRead,
  putContentNotificationAsRead,
  putNotificationAsRead
} from '../action-creator.async.js'
import {
  appendNotificationList,
  newFlashMessage,
  readNotification,
  readNotificationList,
  readContentNotificationList,
  setNextPage
} from '../action-creator.sync.js'
import {
  FETCH_CONFIG,
  ANCHOR_NAMESPACE,
  CONTENT_NAMESPACE
} from '../util/helper.js'
import {
  AVATAR_SIZE,
  CONTENT_TYPE,
  PROFILE,
  displayDistanceDate,
  GenericButton,
  ListItemWrapper,
  PopinFixedHeader,
  TLM_CORE_EVENT_TYPE as TLM_EVENT,
  TLM_ENTITY_TYPE as TLM_ENTITY,
  TLM_SUB_TYPE as TLM_SUB,
  SUBSCRIPTION_TYPE,
  NUMBER_RESULTS_BY_PAGE,
  TracimComponent,
  Avatar,
  ComposedIcon,
  formatAbsoluteDate,
  PAGE
} from 'tracim_frontend_lib'
import { escape as escapeHtml } from 'lodash'

const AUTHOR = 'author'
const SPACE = 'space'
const CONTENT = 'content'

const GROUP_RULES = [
  [3, CONTENT, AUTHOR],
  [3, CONTENT],
  [3, SPACE, AUTHOR],
  [6, SPACE],
  [6, AUTHOR]
]

const getNotificationLabelAndId = (notification) => {
  if (!notification.content) {
    return ['', 0]
  }

  const [entityType, /* eventType */ , contentType] = notification.type.split('.')
  return ((contentType === TLM_SUB.COMMENT) || (entityType === TLM_ENTITY.MENTION && notification.content.type === CONTENT_TYPE.COMMENT))
    ? [notification.content.parentLabel, notification.content.parentId]
    : [notification.content.label, notification.content.id]
}

function getCriterionValue(notification, criterion) {
  if (!notification) return undefined

  switch (criterion) {
    case AUTHOR:
      return notification.author && notification.author.userId

    case SPACE:
      return notification.workspace && notification.workspace.id

    case CONTENT:
      return notification.content && (notification.content.parentId || notification.content.id)

    default:
      return undefined
  }
}

function* notificationsWithGroups(notificationGroupList) {
  for (const group of notificationGroupList) {
    for (const notification of group.list) {
      yield [notification, group]
    }
  }
}

function newGroup (notificationGroupList) {
  const group = {
    minNotificationCountForGrouping: Number.MAX_SAFE_INTEGER,
    grouped: false,
    list: []
  }

  notificationGroupList.push(group)

  return group
}

function matchCriteria (notificationA,  notificationB, firstCriterion, secondCriterion) {
  return (
    getCriterionValue(notificationA, firstCriterion) === getCriterionValue(notificationB, firstCriterion) &&
    getCriterionValue(notificationA, secondCriterion) === getCriterionValue(notificationB, secondCriterion)
  )
}

function zip(l1, l2) {
  const res = []
  const length = Math.max(l1.length, l2.length)
  for (let i = 0; i < length; i++) {
    res.push([l1[i], l2[i]])
  }

  return res
}

export class NotificationWall extends React.Component {
  constructor (props) {
    super(props)
    this.state = {
      notificationGroupList: this.buildNotificationGroups(props.notificationPage)
    }
  }

  handleClickNotification = async (e, notificationList, notificationDetails, dontFollowLink = false) => {
    const { props } = this

    if (dontFollowLink) {
      e.preventDefault()
    } else if (!notificationDetails.url) {
      if (notificationDetails.emptyUrlMsg) {
        props.dispatch(newFlashMessage(notificationDetails.emptyUrlMsg, notificationDetails.msgType || 'warning'))
      }
      e.preventDefault()
    }

    for (const notification of notificationList) {
      if (notification.read) continue
      if (!notification.content) {
        const fetchPutNotificationAsRead = await props.dispatch(putNotificationAsRead(props.user.userId, notification.id))
        switch (fetchPutNotificationAsRead.status) {
          case 204: {
            props.dispatch(readNotification(notification.id))
            break
          }
          default:
            props.dispatch(newFlashMessage(props.t('Error while marking the notification as read'), 'warning'))
        }
      } else {
        const mainContentId = notification.type.endsWith('comment') ? notification.content.parentId : notification.content.id
        const fetchPutContentNotificationAsRead = await props.dispatch(putContentNotificationAsRead(props.user.userId, mainContentId))
        switch (fetchPutContentNotificationAsRead.status) {
          case 204: {
            props.dispatch(readContentNotificationList(mainContentId))
            break
          }
          default:
            props.dispatch(newFlashMessage(props.t('Error while marking the notification as read'), 'warning'))
        }
      }
    }

    props.onCloseNotificationWall()
  }

  handleClickSeeMore = async () => {
    const { props } = this

    const fetchGetNotificationWall = await props.dispatch(getNotificationList(
      props.user.userId,
      {
        excludeAuthorId: props.user.userId,
        notificationsPerPage: NUMBER_RESULTS_BY_PAGE,
        nextPageToken: props.notificationPage.nextPageToken
      }
    ))
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

    const escapedAuthor = notification.author ? escapeHtml(notification.author.publicName) : ''
    const escapedUser = notification.user ? escapeHtml(notification.user.publicName) : ''

    const escapedContentLabel = escapeHtml(getNotificationLabelAndId(notification)[0])

    const escapedWorkspaceLabel = notification.workspace ? escapeHtml(notification.workspace.label) : ''

    const i18nOpts = {
      user: `<span title='${escapedUser}'>${escapedUser}</span>`,
      author: `<span title='${escapedAuthor}'>${escapedAuthor}</span>`,
      content: `<span title='${escapedContentLabel}' class='contentTitle__highlight'>${escapedContentLabel}</span>`,
      space: `<span title="${escapedWorkspaceLabel}" class='documentTitle__highlight'>${escapedWorkspaceLabel}</span>`,
      interpolation: { escapeValue: false }
    }

    const isPublication = notification.content && notification.content.contentNamespace === CONTENT_NAMESPACE.PUBLICATION

    const contentUrl = (
      notification.content
        ? (
          isPublication
            ? PAGE.WORKSPACE.PUBLICATION(notification.workspace.id, notification.content.id)
            : PAGE.WORKSPACE.CONTENT(notification.workspace.id, notification.content.type, notification.content.id)
        )
        : ''
    )

    if (entityType === TLM_ENTITY.CONTENT) {
      const publicationIcon = isPublication ? 'fas fa-stream+' : ''

      switch (eventType) {
        case TLM_EVENT.CREATED: {
          if (contentType === TLM_SUB.COMMENT) {
            return {
              icon: 'far fa-comments',
              title: props.t('Comment_noun'),
              text: props.t('{{author}} commented on {{content}} in {{space}}', i18nOpts),
              url: this.linkToComment(notification),
              action: 'commented',
              sentenceEnding: 'on ' + i18nOpts.content + ' in ' + i18nOpts.space
            }
          }

          return {
            icon: publicationIcon + 'fas fa-magic',
            title: isPublication ? props.t('New publication') : props.t('New content'),
            text: props.t('{{author}} created {{content}} in {{space}}', i18nOpts),
            action: 'created',
            sentenceEnding: i18nOpts.content + ' in ' + i18nOpts.space,
            url: contentUrl
          }
        }
        case TLM_EVENT.MODIFIED: {
          if (notification.content.currentRevisionType === 'status-update') {
            return {
              icon: publicationIcon + 'fas fa-random',
              title: props.t('Status updated'),
              text: props.t('{{author}} changed the status of {{content}} in {{space}}', i18nOpts),
              action: 'changed the status',
              sentenceEnding: 'of ' + i18nOpts.content + ' in ' + i18nOpts.space,
              url: contentUrl
            }
          }

          return {
            icon: publicationIcon + 'fas fa-history',
            title: isPublication ? props.t('Publication updated') : props.t('Content updated'),
            text: props.t('{{author}} updated {{content}} in {{space}}', i18nOpts),
            action: 'updated',
            sentenceEnding: i18nOpts.content + ' in ' + i18nOpts.space,
            url: contentUrl
          }
        }
        case TLM_EVENT.DELETED: {
          return {
            icon: publicationIcon + 'fas fa-times',
            title: isPublication ? props.t('Publication deleted') : props.t('Content deleted'),
            text: props.t('{{author}} deleted {{content}} from {{space}}', i18nOpts),
            action: 'deleted',
            sentenceEnding: i18nOpts.content + ' in ' + i18nOpts.space,
            url: contentUrl
          }
        }
        case TLM_EVENT.UNDELETED: {
          return {
            icon: publicationIcon + 'fas fa-undo',
            title: isPublication ? props.t('Publication restored') : props.t('Content restored'),
            text: props.t('{{author}} restored {{content}} in {{space}}', i18nOpts),
            action: 'deleted',
            sentenceEnding: i18nOpts.content + ' in ' + i18nOpts.space,
            url: contentUrl
          }
        }
      }
    }

    if (entityType === TLM_ENTITY.MENTION && eventType === TLM_EVENT.CREATED) {
      if (notification.content.type === CONTENT_TYPE.COMMENT) {
        return {
          icon: 'far fa-comment',
          title: props.t('Mention'),
          text: props.t('{{author}} mentioned you in a comment in {{content}} in {{space}}', i18nOpts),
          url: this.linkToComment(notification),
          action: 'mentioned you in a comment',
          sentenceEnding: 'in ' + i18nOpts.content + ' in ' + i18nOpts.space,
          isMention: true
        }
      }

      return {
        icon: 'fas fa-at',
        title: props.t('Mention'),
        text: props.t('{{author}} mentioned you in {{content}} in {{space}}', i18nOpts),
        action: 'mentioned you',
        sentenceEnding: 'in ' + i18nOpts.content + ' in ' + i18nOpts.space,
        url: contentUrl,
        isMention: true
      }
    }

    if (entityType === TLM_ENTITY.USER) {
      const details = {
        url: (props.user.profile === PROFILE.administrator.slug)
          ? PAGE.ADMIN.USER_EDIT(notification.user.userId)
          : PAGE.PUBLIC_PROFILE(notification.user.userId),
        emptyUrlMsg: props.t("Only an administrator can see this user's account"),
        sentenceEnding: '',
        msgType: 'info'
      }

      switch (eventType) {
        case TLM_EVENT.CREATED: return {
          ...details,
          icon: 'fas fa-user-plus',
          title: props.t('Account created'),
          text: props.t("{{author}} created {{user}}'s account", i18nOpts),
          action: "created {{user}}'s account"
        }
        case TLM_EVENT.MODIFIED: return {
          ...details,
          icon: 'fas fa-user+fas fa-history',
          title: props.t('Account updated'),
          text: props.t("{{author}} modified {{user}}'s account", i18nOpts),
          action: "modified {{user}}'s account"
        }
        case TLM_EVENT.DELETED: return {
          ...details,
          icon: 'fas fa-user-times',
          title: props.t('Account deleted'),
          text: props.t("{{author}} deleted {{user}}'s account", i18nOpts),
          action: "deleted {{user}}'s account"
        }
        case TLM_EVENT.UNDELETED: return {
          ...details,
          icon: 'fas fa-user+fas fa-undo',
          title: props.t('Account restored'),
          text: props.t("{{author}} restored {{user}}'s account", i18nOpts),
          action: "restored {{user}}'s account"
        }
      }
    }

    const dashboardUrl = notification.workspace ? PAGE.WORKSPACE.DASHBOARD(notification.workspace.id) : ''

    if (entityType === TLM_ENTITY.SHAREDSPACE_MEMBER) {
      switch (eventType) {
        case TLM_EVENT.CREATED: {
          let notificationText
          if (props.user.userId === notification.user.userId) {
            notificationText = props.t('{{author}} added you to {{space}}', i18nOpts)
          } else {
            if (notification.author.userId === notification.user.userId) {
              notificationText = props.t('{{author}} joined space {{space}}', i18nOpts)
            } else {
              notificationText = props.t('{{author}} added {{user}} to {{space}}', i18nOpts)
            }
          }
          return {
            icon: 'fas fa-user-plus',
            action: (props.user.userId === notification.user.userId) ? 'added you' : 'added ' + i18nOpts.user,
            sentenceEnding: 'to ' + i18nOpts.space,
            title: props.t('New access'),
            text: notificationText,
            url: dashboardUrl
          }
        }
        case TLM_EVENT.MODIFIED: return {
          icon: 'far fa-user+fas fa-history',
          title: props.t('Status updated'),
          text: props.user.userId === notification.user.userId
            ? props.t('{{author}} modified your role in {{space}}', i18nOpts)
            : props.t("{{author}} modified {{user}}'s role in {{space}}", i18nOpts),
          action: (props.user.userId === notification.user.userId) ? 'added you' : 'added ' + i18nOpts.user,
          sentenceEnding: 'in ' + i18nOpts.space,
          url: dashboardUrl
        }
        case TLM_EVENT.DELETED: return {
          icon: 'fas fa-user-times',
          title: props.t('Access removed'),
          text: props.user.userId === notification.user.userId
            ? props.t('{{author}} removed you from {{space}}', i18nOpts)
            : props.t('{{author}} removed {{user}} from {{space}}', i18nOpts),
          action: (props.user.userId === notification.user.userId) ? 'added you' : 'added ' + i18nOpts.user,
          sentenceEnding: 'from ' + i18nOpts.space,
          url: dashboardUrl
        }
      }
    }

    if (entityType === TLM_ENTITY.SHAREDSPACE) {
      switch (eventType) {
        case TLM_EVENT.CREATED: return {
          icon: 'fas fa-users+fas fa-plus',
          title: props.t('New space'),
          text: props.t('{{author}} created the space {{space}}', i18nOpts),
          action: 'created',
          sentenceEnding: 'the space ' + i18nOpts.space,
          url: dashboardUrl
        }
        case TLM_EVENT.MODIFIED: return {
          icon: 'fas fa-users+fas fa-history',
          title: props.t('Space updated'),
          text: props.t('{{author}} modified the space {{space}}', i18nOpts),
          action: 'modified',
          sentenceEnding: 'the space ' + i18nOpts.space,
          url: dashboardUrl
        }
        case TLM_EVENT.DELETED: return {
          icon: 'fas fa-users+fas fa-times',
          title: props.t('Space deleted'),
          text: props.t('{{author}} deleted the space {{space}}', i18nOpts),
          action: 'deleted',
          sentenceEnding: 'the space ' + i18nOpts.space,
          url: dashboardUrl
        }
        case TLM_EVENT.UNDELETED: return {
          icon: 'fas fa-users+fas fa-undo',
          title: props.t('Space restored'),
          text: props.t('{{author}} restored the space {{space}}', i18nOpts),
          action: 'restored',
          sentenceEnding: 'the space ' + i18nOpts.space,
          url: dashboardUrl
        }
      }
    }

    const defaultEmptyUrlMsg = props.t('This notification has no associated content')

    const subscriptionPageURL = '' // RJ - 2020-10-19 - FIXME: depends on https://github.com/tracim/tracim/issues/3594

    if (entityType === TLM_ENTITY.SHAREDSPACE_SUBSCRIPTION) {
      // INFO - GB - 2020-12-29 - MODIFIED.accepted and DELETED events do not make notifications

      if (props.user.userId === notification.subscription.author.userId) {
        // RJ - 2020-10-19 - NOTE
        // TLM_EVENT.CREATED notifications should not be shown, or even received
        // assuming that the author of a subscription is always the concerned user
        if (eventType === TLM_EVENT.MODIFIED) {
          if (notification.subscription.state === SUBSCRIPTION_TYPE.accepted.slug) return {}
          if (notification.subscription.state === SUBSCRIPTION_TYPE.rejected.slug) {
            return {
              icon: SUBSCRIPTION_TYPE.rejected.faIcon,
              title: props.t('Access removed'),
              text: props.t('{{author}} rejected your access to {{space}}', i18nOpts),
              url: subscriptionPageURL,
              emptyUrlMsg: defaultEmptyUrlMsg
            }
          }
        }
      } else {
        switch (eventType) {
          case TLM_EVENT.CREATED: return {
            icon: SUBSCRIPTION_TYPE.pending.faIcon,
            title: props.t('Requested access'),
            text: props.t('{{author}} requested access to {{space}}', i18nOpts),
            url: dashboardUrl
          }
          case TLM_EVENT.MODIFIED: {
            if (notification.subscription.state === SUBSCRIPTION_TYPE.accepted.slug) return {}
            if (notification.subscription.state === SUBSCRIPTION_TYPE.rejected.slug) {
              return {
                icon: SUBSCRIPTION_TYPE.rejected.faIcon,
                title: props.t('Access removed'),
                text: props.t('{{author}} rejected access to {{space}} for {{user}}', i18nOpts),
                url: defaultEmptyUrlMsg
              }
            }

            if (notification.subscription.state === SUBSCRIPTION_TYPE.pending.slug) {
              return {
                icon: SUBSCRIPTION_TYPE.pending.faIcon,
                title: props.t('Requested access'),
                text: props.t('{{author}} requested access to {{space}}', i18nOpts),
                url: dashboardUrl
              }
            }
          }
        }
      }
    }

    if (entityType === TLM_ENTITY.REACTION) {
      i18nOpts.reaction = notification.reaction.value

      switch (eventType) {
        case TLM_EVENT.CREATED: return {
          icon: 'far fa-smile+fas fa-plus',
          title: props.t('Reaction created'),
          text: props.t('{{author}} reacted to {{content}} with {{reaction}}', i18nOpts),
          url: contentUrl
        }
        case TLM_EVENT.DELETED: return {
          icon: 'far fa-smile+fas fa-times',
          title: props.t('Reaction deleted'),
          text: props.t('{{author}} removed their reaction {{reaction}} to {{content}}', i18nOpts),
          url: contentUrl
        }
      }
    }

    return {
      icon: 'fas fa-bell',
      text: `${escapedAuthor} ${notification.type}`,
      url: contentUrl,
      emptyUrlMsg: defaultEmptyUrlMsg,
      action: notification.type,
      sentenceEnding: '',
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

  linkToComment (notification) {
    return (
      notification.content.parentContentNamespace === CONTENT_NAMESPACE.PUBLICATION
        ? PAGE.WORKSPACE.PUBLICATION(notification.workspace.id, notification.content.parentId)
        : PAGE.WORKSPACE.CONTENT(notification.workspace.id, notification.content.parentContentType, notification.content.parentId)
    )
  }

  toggleGroup (spaceId) {
    this.setState(prev => ({
      unfoldedNotificationGroup: { ...prev.unfoldedNotificationGroup, [spaceId]: !this.state.unfoldedNotificationGroup[spaceId] }
    }))
  }

  componentDidUpdate (prevProps) {
    const { props } = this

    if (zip(props?.notificationPage?.list || [], prevProps?.notificationPage?.list || []).every(
      ([notificationA, notificationB]) => notificationA?.id === notificationB?.id && notificationA?.read === notificationB?.read)
    ) {
      return
    }

    this.setState({ notificationGroupList: this.buildNotificationGroups(props.notificationPage) })
  }

  buildNotificationGroups (notificationPage) {
    console.log(notificationPage, notificationPage?.list)
    if (!notificationPage?.list) return []

    let notificationGroupList = [{
      minNotificationCountForGrouping: Number.MAX_SAFE_INTEGER,
      grouped: false,
      list: notificationPage.list
    }]

    for (const [minNotificationCountForGrouping, firstCriterion, secondCriterion] of GROUP_RULES) {
      console.log("Grouping by", [firstCriterion, secondCriterion], notificationGroupList)
      const newNotificationGroupList = []

      let lastGroup = newNotificationGroupList[newNotificationGroupList.length - 1] || newGroup(newNotificationGroupList)

      for (const group of notificationGroupList) {
        if (!group.list.length) {
          continue
        }

        let match = true

        if (lastGroup.grouped) {
          outer: for (const notification of group.list) {
            for (const notificationLastGroup of lastGroup.list) {
              if (!matchCriteria(
                notification,
                notificationLastGroup,
                firstCriterion,
                secondCriterion
              )) {
                match = false
                break outer
              }
            }
          }

          if (match) {
            lastGroup.list = [
              ...lastGroup.list,
              ...group.list
            ]
            lastGroup.grouped.push([firstCriterion, secondCriterion])
            continue
          }
        }

        if (group.grouped) {
          newNotificationGroupList.push(group)
          lastGroup = group
          continue
        }

        lastGroup = newGroup(newNotificationGroupList)

        for (const notification of group.list) {
          const lastGroupLastNotification = lastGroup.list[lastGroup.list.length - 1]

          if (lastGroupLastNotification) {
            if (matchCriteria(
              notification,
              lastGroupLastNotification,
              firstCriterion,
              secondCriterion
            )) {
              lastGroup.grouped = [[firstCriterion, secondCriterion]]
            } else {
              lastGroup = newGroup(newNotificationGroupList)
            }
          }

          lastGroup.list.push(notification)
        }
      }

      notificationGroupList = newNotificationGroupList
      console.log("Grouped by", [firstCriterion, secondCriterion], notificationGroupList)
    }

    console.log("NOTIFICATIONGROUPLIST", notificationGroupList, notificationPage?.list)
    return notificationGroupList
  }

  render () {
    const { props, state } = this

    if (!props.notificationPage.list) return null

    return (
      <div className={classnames('notification', { notification__wallClose: !props.isNotificationWallOpen })}>
        <PopinFixedHeader
          customClass='notification'
          faIcon='far fa-bell'
          rawTitle={props.t('Notifications')}
          componentTitle={<div>{props.t('Notifications')}</div>}
          onClickCloseBtn={props.onCloseNotificationWall}
        >
          <GenericButton
            customClass='btn outlineTextBtn primaryColorBorder primaryColorBgHover primaryColorBorderDarkenHover'
            onClick={this.handleClickMarkAllAsRead}
            label={props.t('Mark all as read')}
            faIcon='far fa-envelope-open'
            dataCy='markAllAsReadButton'
          />
        </PopinFixedHeader>

        <div className='notification__groups'>
          {state.notificationGroupList.map(({ grouped, groupId, list }) => {
            console.log("NOTIFICATION GROUP", grouped, groupId, list)
            const detailsList = list.map(notification => this.getNotificationDetails(notification))
            if (list.length === 1 || !grouped || list.length < list.minNotificationCountForGrouping) {
              return zip(list, detailsList).map(
                ([notification, details]) => this.renderNotication(
                  notification,
                  details,
                  list
                )
              )
            }

            const authors = this.joinComma(list.filter(n => n.author).map(n => n.author.publicName))
            const actions = this.joinComma(detailsList.filter(d => d.action).map(d => d.action))

            const mergedDetails = {
              text: (
                authors +
                ' ' +
                actions +
                ' ' +
                this.joinComma(detailsList.map(d => d.sentenceEnding))
              ),
              icon: (detailsList.find(d => d.icon) || {}).icon,
              url: (detailsList.find(d => d.url) || {}).url,
              isMention: detailsList.some(d => d.isMention),
              grouped
            }

            return this.renderNotication(
              list[0],
              mergedDetails,
              list
            )
          }).flat()}
        </div>
        {(props.notificationPage.hasNextPage &&
          <div className='notification__footer'>
            <GenericButton
              customClass='btn outlineTextBtn primaryColorBorder primaryColorBgHover primaryColorBorderDarkenHover'
              onClick={this.handleClickSeeMore}
              label={props.t('See more')}
              faIcon='fas fa-chevron-down'
            />
          </div>
        )}
      </div>
    )
  }

  joinComma (toJoin) {
    const joined = []
    for (const e of toJoin) {
      if (!joined.includes(e)) {
        joined.push(e)
      }
    }

    if (joined.length > 1) {
      const last = joined.pop()
      const beforeLast = joined.pop()
      joined.push(beforeLast + ' and ' + last)
    }

    return joined.join(', ')
  }

  renderNotication = (notification, notificationDetails, relatedNotifications) => {
    if (Object.keys(notificationDetails).length === 0) return
    const icons = notificationDetails.icon.split('+')
    const icon = (
      icons.length === 1
        ? <i title={notificationDetails.title} className={`fa fa-fw fa-${icons[0]}`} />
        : <ComposedIcon titleIcon={notificationDetails.title} mainIcon={icons[0]} smallIcon={icons[1]} />
    )

    const read = relatedNotifications.every(notification => notification.read)
    const { props } = this
    if (notificationDetails.grouped) {
      notificationDetails.grouped = [notificationDetails.grouped[notificationDetails.grouped.length - 1]]
    }

    return (
      <ListItemWrapper
        isLast={notification === relatedNotifications[relatedNotifications.length - 1]}
        // FIXME - notifications are always last with two consecutive spaces with one notification, which is not desirable
        read={read}
        id={`${ANCHOR_NAMESPACE.notificationItem}:${notification.id}`}
        key={notification.id}
      >
        <Link
          to={notificationDetails.url || '#'}
          onClick={(e) => this.handleClickNotification(e, relatedNotifications, notificationDetails)}
          className={classnames('notification__list__item', { itemRead: read, isMention: notificationDetails.isMention })}
          key={notification.id}
          title={notificationDetails.grouped && ('Grouped because: ' + relatedNotifications.length + ' times the ' + notificationDetails.grouped.map(criteria => 'same ' + criteria.filter(c => c).join('+')).join(', then '))}
        >
          {icon}
          <div className='notification__list__item__text'>
            <Avatar
              size={AVATAR_SIZE.MINI}
              apiUrl={FETCH_CONFIG.apiUrl}
              user={notification.author}
              style={{ marginRight: '5px' }}
            />
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
          {!read && <i onClick={(e) => this.handleClickNotification(e, relatedNotifications, notificationDetails, true)} className='notification__list__item__circle fas fa-circle' />}
        </Link>
      </ListItemWrapper>
    )
  }
}

const mapStateToProps = ({ user, notificationPage }) => ({ user, notificationPage })
export default connect(mapStateToProps)(translate()(TracimComponent(NotificationWall)))

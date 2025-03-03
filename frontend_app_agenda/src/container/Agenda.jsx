import React from 'react'
import { translate } from 'react-i18next'
import i18n from '../i18n.js'
import {
  addAllResourceI18n,
  handleFetchResult,
  getWorkspaceDetail,
  getWorkspaceMemberList,
  sendGlobalFlashMessage,
  PageContent,
  PageTitle,
  PageWrapper,
  BREADCRUMBS_TYPE,
  CUSTOM_EVENT,
  PAGE,
  RefreshWarningMessage,
  TLM_CORE_EVENT_TYPE as TLM_CET,
  TLM_ENTITY_TYPE as TLM_ET,
  TracimComponent
} from 'tracim_frontend_lib'
import { debug } from '../debug.js'
import { getAgendaList, getPreFilledAgendaEvent } from '../action.async.js'

export class Agenda extends React.Component {
  constructor (props) {
    super(props)

    const param = props.data || debug

    this.state = {
      appName: 'agenda',
      isVisible: true,
      config: param.config,
      loggedUser: param.loggedUser,
      content: param.content,
      userWorkspaceList: [],
      userWorkspaceListLoaded: false,
      preFilledAgendaEvent: null,
      breadcrumbsList: [],
      appMounted: false,
      editionAuthor: '',
      showRefreshWarning: false
    }

    // i18n has been init, add resources from frontend
    addAllResourceI18n(i18n, this.state.config.translation, this.state.loggedUser.lang)
    i18n.changeLanguage(this.state.loggedUser.lang)

    props.registerCustomEventHandlerList([
      { name: CUSTOM_EVENT.SHOW_APP(this.state.config.slug), handler: this.handleShowApp },
      { name: CUSTOM_EVENT.ALL_APP_CHANGE_LANGUAGE, handler: this.handleAllAppChangeLanguage }
    ])

    props.registerLiveMessageHandlerList([
      { entityType: TLM_ET.USER, coreEntityType: TLM_CET.MODIFIED, handler: this.handleUserModified },
      { entityType: TLM_ET.SHAREDSPACE, coreEntityType: TLM_CET.MODIFIED, handler: this.handleSharedspaceModified }
    ])
  }

  // Custom Event Handlers
  handleShowApp = data => {
    console.log('%c<Agenda> Custom event', 'color: #28a745', CUSTOM_EVENT.SHOW_APP(this.state.config.slug), data)
    if (data.config.appConfig.workspaceId !== this.state.config.appConfig.workspaceId) {
      this.setState({ config: data.config })
    }
  }

  handleAllAppChangeLanguage = data => {
    const { props, state } = this
    console.log('%c<Agenda> Custom event', 'color: #28a745', CUSTOM_EVENT.ALL_APP_CHANGE_LANGUAGE, data)

    this.setState(prev => ({
      loggedUser: {
        ...prev.loggedUser,
        lang: data
      }
    }))
    i18n.changeLanguage(data)
    this.buildBreadcrumbs()
    this.setHeadTitle(state.config.appConfig.workspaceId !== null
      ? `${props.t('Agenda')} · ${state.content.workspaceLabel}`
      : props.t('My agendas')
    )
    this.agendaIframe.contentWindow.location.reload()
  }

  // TLM Handlers
  handleUserModified = data => {
    if (this.state.loggedUser.userId !== data.fields.user.user_id) return

    this.setState(prev => ({
      loggedUser: {
        ...prev.loggedUser,
        authType: data.fields.user.auth_type,
        avatarUrl: data.fields.user.avatar_url,
        email: data.fields.user.email,
        isActive: data.fields.user.is_active,
        profile: data.fields.user.profile,
        publicName: data.fields.user.public_name,
        timezone: data.fields.user.timezone,
        username: data.fields.user.username
      },
      editionAuthor: data.fields.author.public_name,
      // INFO - GB - 2020-06-18 - Just show the warning message if there have been any changes in "My agendas" page and if it's not the language that changes (handled by custom event)
      // state.userWorkspaceList.length !== 1 represents "My Agendas" page because for the agendas of a specific workspace the state.userWorkspaceList.length is always 1 (there is only the workspace in the list)
      // and there is no need to show the warning in these agendas because there is no data that can be changed visible.
      showRefreshWarning: prev.userWorkspaceList.length !== 1 && prev.loggedUser.lang === data.fields.user.lang
    }))
  }

  handleSharedspaceModified = data => {
    const { state } = this
    if (!state.userWorkspaceList.find(workspace => workspace.workspace_id === data.fields.workspace.workspace_id)) return

    this.setState({
      content: {
        workspaceLabel: data.fields.workspace.label
      },
      editionAuthor: data.fields.author.public_name,
      // INFO - GB - 2020-06-18 - Just show the warning message if there have been any changes in "My agendas" page
      // state.userWorkspaceList.length !== 1 represents "My Agendas" page because for the agendas of a specific workspace the state.userWorkspaceList.length is always 1 (there is only the workspace in the list)
      // and there is no need to show the warning in these agendas because there is no data that can be changed visible.
      showRefreshWarning: state.userWorkspaceList.length !== 1
    })
    if (state.userWorkspaceList.length === 1) this.buildBreadcrumbs()
  }

  async componentDidMount () {
    const { state, props } = this
    console.log('%c<Agenda> did mount', `color: ${state.config.hexcolor}`)

    this.loadAgendaList(state.config.appConfig.workspaceId)
    this.loadPrefilledAgendaEvent()
    if (state.config.appConfig.workspaceId !== null) {
      await this.loadWorkspaceData()
    } else {
      this.setHeadTitle(props.t('My agendas'))
    }
    this.buildBreadcrumbs()
  }

  async componentDidUpdate (prevProps, prevState) {
    const { state } = this
    // console.log('%c<Agenda> did update', `color: ${state.config.hexcolor}`, prevState, state)

    if (prevState.config.appConfig.workspaceId !== state.config.appConfig.workspaceId) {
      if (state.config.appConfig.workspaceId) await this.loadAgendaList(state.config.appConfig.workspaceId)
      await this.loadWorkspaceData()
      this.buildBreadcrumbs()
      this.agendaIframe.contentWindow.location.reload()
    }
  }

  handleClickRefresh = () => {
    this.setState({ showRefreshWarning: false })
    this.agendaIframe.contentWindow.location.reload()
  }

  setHeadTitle = (title) => {
    GLOBAL_dispatchEvent({
      type: CUSTOM_EVENT.SET_HEAD_TITLE,
      data: { title: title }
    })
  }

  loadAgendaList = async workspaceId => {
    const { state, props } = this

    const fetchResultUserWorkspace = await handleFetchResult(
      await getAgendaList(state.config.apiUrl, workspaceId)
    )

    switch (fetchResultUserWorkspace.apiResponse.status) {
      case 200:
        this.loadUserRoleInWorkspace(fetchResultUserWorkspace.body)
        break
      case 400:
        switch (fetchResultUserWorkspace.body.code) {
          default: sendGlobalFlashMessage(props.t('Error while loading space list'))
        }
        break
      default: sendGlobalFlashMessage(props.t('Error while loading space list'))
    }
  }

  async loadPrefilledAgendaEvent () {
    const fetchGetPreFilledAgendaEvent = await handleFetchResult(
      await getPreFilledAgendaEvent(this.state.config.apiUrl)
    )

    if (fetchGetPreFilledAgendaEvent.apiResponse.ok) {
      this.setState({ preFilledAgendaEvent: fetchGetPreFilledAgendaEvent.body })
    } else {
      sendGlobalFlashMessage(this.props.t('Error while loading pre-filled agenda event information'))
      this.setState({ preFilledAgendaEvent: {} })
    }
  }

  // INFO - CH - 2019-04-09 - This function is complicated because, right now, the only way to get the user's role
  // on a workspace is to extract it from the members list that workspace
  // see https://github.com/tracim/tracim/issues/1581
  loadUserRoleInWorkspace = async agendaList => {
    const { state, props } = this
    const fetchResultList = await Promise.all(
      agendaList
        .filter(a => a.agenda_type === 'workspace')
        .map(async a => {
          const fetchWorkspaceMemberList = await handleFetchResult(await getWorkspaceMemberList(state.config.apiUrl, a.workspace_id))
          return fetchWorkspaceMemberList
        })
    )

    const fetchResultSuccess = fetchResultList.filter(result => result.apiResponse.status === 200)
    if (fetchResultSuccess.length < fetchResultList.length) sendGlobalFlashMessage(props.t('Some agenda could not be loaded'))

    const workspaceListMemberList = fetchResultSuccess.map(result => ({
      workspaceId: result.body[0].workspace_id, // INFO - CH - 2019-04-09 - workspaces always have at least one member
      memberList: result.body || []
    }))

    const agendaThatCouldGetRoleFrom = agendaList
      // INFO - CH - 2019-04-09 - remove user's agenda
      .filter(a => a.agenda_type === 'workspace')
      // INFO - CH - 2019-04-09 - remove unloaded members list agenda
      .filter(a => workspaceListMemberList.map(ws => ws.workspaceId).includes(a.workspace_id))

    const agendaListWithRole = agendaThatCouldGetRoleFrom.map(agenda => ({
      ...agenda,
      loggedUserRole: workspaceListMemberList
        .find(ws => ws.workspaceId === agenda.workspace_id)
        .memberList
        .find(user => user.user_id === state.loggedUser.userId)
        .role
    }))

    if (state.config.appConfig.workspaceId === null) {
      agendaListWithRole.push(agendaList.find(a => a.agenda_type === 'private'))
    }

    this.setState({
      userWorkspaceList: agendaListWithRole,
      userWorkspaceListLoaded: true
    })
  }

  buildBreadcrumbs = () => {
    const { props, state } = this

    const breadcrumbsList = []

    const workspaceId = state.config.appConfig.workspaceId
    if (workspaceId) {
      breadcrumbsList.push({
        link: PAGE.WORKSPACE.DASHBOARD(workspaceId),
        type: BREADCRUMBS_TYPE.APP_FULLSCREEN,
        label: state.content.workspaceLabel,
        isALink: true
      }, {
        link: PAGE.WORKSPACE.AGENDA(workspaceId),
        type: BREADCRUMBS_TYPE.CORE,
        label: props.t('Agenda'),
        isALink: true
      })
    } else {
      breadcrumbsList.push({
        link: PAGE.AGENDA,
        type: BREADCRUMBS_TYPE.CORE,
        label: props.t('All my agendas'),
        isALink: true
      })
    }

    // FIXME - CH - 2019/04/25 - We should keep redux breadcrumbs sync with fullscreen apps but when do the setBreadcrumbs,
    // app crash telling it cannot render a Link outside a router
    // see https://github.com/tracim/tracim/issues/1637
    // GLOBAL_dispatchEvent({type: 'setBreadcrumbs', data: {breadcrumbs: breadcrumbsList}})
    this.setState({ breadcrumbsList: breadcrumbsList })
  }

  loadWorkspaceData = async () => {
    const { state, props } = this

    const fetchResultWorkspaceDetail = await handleFetchResult(
      await getWorkspaceDetail(state.config.apiUrl, state.config.appConfig.workspaceId)
    )

    switch (fetchResultWorkspaceDetail.apiResponse.status) {
      case 200:
        this.setState({
          content: {
            workspaceLabel: fetchResultWorkspaceDetail.body.label
          }
        })
        this.setHeadTitle(`${props.t('Agenda')} · ${fetchResultWorkspaceDetail.body.label}`)
    }
  }

  render () {
    const { props, state } = this

    if (!state.isVisible || !state.userWorkspaceListLoaded || !state.preFilledAgendaEvent) return null

    const config = {
      globalAccountSettings: {
        agendaList: state.userWorkspaceList.map(a => ({
          href: a.agenda_url,
          hrefLabel: a.agenda_type === 'private'
            ? props.t('User')
            : state.userWorkspaceList.length > 1 ? props.t('Spaces') : props.t('Space'),
          settingsAccount: a.agenda_type === 'private',
          withCredentials: a.with_credentials,
          loggedUserRole: a.agenda_type === 'private' ? '' : a.loggedUserRole,
          workspaceId: a.agenda_type === 'private' ? '' : a.workspace_id
        }))
      },
      userLang: state.loggedUser.lang,
      preFilledAgendaEvent: state.preFilledAgendaEvent,
      shouldShowCaldavzapSidebar: state.config.appConfig.forceShowSidebar
    }

    // INFO - GB - 2019-06-11 - This tag dangerouslySetInnerHTML is needed to i18next be able to handle special characters
    // https://github.com/tracim/tracim/issues/1847
    const pageTitle = state.config.appConfig.workspaceId === null
      ? props.t('All my agendas')
      : (
        <div
          dangerouslySetInnerHTML={{
            __html: props.t(
              'Agenda of space {{workspaceLabel}}', {
                workspaceLabel: state.content.workspaceLabel,
                interpolation: { escapeValue: false }
              }
            )
          }}
        />
      )

    return (
      <PageWrapper customClass='agendaPage'>
        <PageTitle
          parentClass='agendaPage'
          title={pageTitle}
          icon='fas fa-calendar-alt'
          breadcrumbsList={state.breadcrumbsList}
        />

        <div className='agendaPage__warningMessage'>
          {state.showRefreshWarning && (
            <RefreshWarningMessage
              tooltip={props.t('Some information was modified by {{author}}', { author: state.editionAuthor, interpolation: { escapeValue: false } })}
              onClickRefresh={this.handleClickRefresh}
            />
          )}
        </div>

        <PageContent parentClass='agendaPage'>
          <iframe
            id='agendaIframe'
            src='/assets/_caldavzap/index.tracim.html'
            allow='fullscreen'
            allowFullScreen
            data-config={JSON.stringify(config)}
            ref={f => { this.agendaIframe = f }}
          />
        </PageContent>
      </PageWrapper>
    )
  }
}

export default translate()(TracimComponent(Agenda))

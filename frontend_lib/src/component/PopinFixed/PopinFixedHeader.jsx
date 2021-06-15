import React from 'react'
import classnames from 'classnames'
import PropTypes from 'prop-types'
import { translate } from 'react-i18next'
import { ROLE } from '../../helper.js'
import DropdownMenu from '../DropdownMenu/DropdownMenu.jsx'
import FavoriteButton from '../Button/FavoriteButton.jsx'
import FAVORITE_STATE from '../Button/FavoriteButton.jsx'
import { appContentFactory } from '../../appContentFactory.js'
import { getLocalStorageItem } from '../../localStorage.js'
import { LOCAL_STORAGE_FIELD } from '../../localStorage.js'
import { debug } from '../../debug.js'

class PopinFixedHeader extends React.Component {
  constructor (props) {
    super(props)

    const param = props.data || debug
    props.setApiUrl(param.config.apiUrl)

    this.state = {
      editTitle: false,
      editTitleValue: props.rawTitle,
      config: param.config,
      loggedUser: param.loggedUser,
      content: param.content
    }
  }

  async componentDidMount () {
    // console.log('%c<File> did mount', `color: ${this.state.config.hexcolor}`)
    this.updateTimelineAndContent()
    this.props.loadFavoriteContentList(this.state.loggedUser, this.setState.bind(this))
  }

  async updateTimelineAndContent (pageToLoad = null) {
    this.setState({
      newComment: getLocalStorageItem(
        this.state.appName,
        this.state.content,
        LOCAL_STORAGE_FIELD.COMMENT
      ) || ''
    })

    await this.loadContent(pageToLoad)
    this.loadTimeline()
    // if (this.state.config.workspace.downloadEnabled) this.loadShareLinkList()
  }

  componentDidUpdate (prevProps, prevState) {
    const { state } = this

    // console.log('%c<File> did update', `color: ${this.state.config.hexcolor}`, prevState, state)
    if (!prevState.content || !state.content) return

    if (prevState.content.content_id !== state.content.content_id) {
      this.setState({ fileCurrentPage: 1 })
      // this.updateTimelineAndContent(1)
    }

    if (prevState.timelineWysiwyg && !state.timelineWysiwyg) globalThis.tinymce.remove('#wysiwygTimelineComment')
  }


  componentDidUpdate (prevProps) {
    if (prevProps.rawTitle !== this.props.rawTitle) this.setState({ editTitleValue: this.props.rawTitle })
  }

  handleChangeTitle = e => {
    const newTitle = e.target.value
    this.setState({ editTitleValue: newTitle })
  }

  handleClickChangeTitleBtn = () => {
    const { props, state } = this
    if (state.editTitle) {
      props.onValidateChangeTitle(state.editTitleValue)
      this.setState(prevState => ({ editTitle: !prevState.editTitle }))
      return
    }

    this.setState(prevState => ({
      editTitle: !prevState.editTitle,
      editTitleValue: props.rawTitle
    }))
  }

  handleClickUndoChangeTitleBtn = () => {
    this.setState({
      editTitle: false,
      editTitleValue: this.props.rawTitle
    })
  }

  handleInputKeyPress = e => {
    switch (e.key) {
      case 'Enter': this.handleClickChangeTitleBtn(); break
      case 'Escape': this.handleClickUndoChangeTitleBtn(); break
    }
  }

  render () {
    const { customClass, customColor, faIcon, rawTitle, componentTitle, userRoleIdInWorkspace, onClickCloseBtn, disableChangeTitle, showChangeTitleButton, t } = this.props
    const { state, props } = this


    return (
      <div className={classnames('wsContentGeneric__header', `${customClass}__header`)} style={{ backgroundColor: customColor }}>
        <div className={classnames('wsContentGeneric__header__icon', `${customClass}__header__icon`)}>
          <i className={`${faIcon}`} title={rawTitle} />
        </div>

        <div
          className={classnames('wsContentGeneric__header__title', `${customClass}__header__title`)}
          title={rawTitle}
        >
          {state.editTitle
            ? (
              <input
              className='wsContentGeneric__header__title__editiontitle editiontitle'
              value={state.editTitleValue}
              onChange={this.handleChangeTitle}
              onKeyDown={this.handleInputKeyPress}
              autoFocus
              />
              )
              : componentTitle}
        </div>

        <FavoriteButton
          favoriteState={props.isContentInFavoriteList(state.content, state)
            ? FAVORITE_STATE.FAVORITE
            : FAVORITE_STATE.NOT_FAVORITE}
          onClickAddToFavoriteList={() => props.addContentToFavoriteList(
            state.content, state.loggedUser, this.setState.bind(this)
          )}
          onClickRemoveFromFavoriteList={() => props.removeContentFromFavoriteList(
            state.content, state.loggedUser, this.setState.bind(this)
          )}
        />

        <DropdownMenu
          buttonCustomClass=''
          // buttonClick={props.onEventClicked} // eslint-disable-line
          buttonIcon='fas fa-ellipsis-v'
          buttonTooltip=''
        >
          <span>hi</span>
          <span>hello</span>

          {userRoleIdInWorkspace >= ROLE.contributor.id && state.editTitle &&
            <button
            className={classnames('wsContentGeneric__header__edittitle', `${customClass}__header__changetitle iconBtn`)}
            onClick={this.handleClickUndoChangeTitleBtn}
            disabled={disableChangeTitle}
            >
              <i className='fas fa-undo' title={t('Undo change in title')} />
            </button>}

          {userRoleIdInWorkspace >= ROLE.contributor.id && showChangeTitleButton &&
            <button
            className={classnames('wsContentGeneric__header__edittitle', `${customClass}__header__changetitle iconBtn`)}
            onClick={this.handleClickChangeTitleBtn}
            disabled={disableChangeTitle}
            >
              {state.editTitle
                ? <i className='fas fa-check' title={t('Validate the title')} />
                : <i className='fas fa-pencil-alt' title={t('Edit title')} />}
            </button>}

          {this.props.children}
        </DropdownMenu>

        <div
          className={classnames('wsContentGeneric__header__close', `${customClass}__header__close iconBtn`)}
          onClick={onClickCloseBtn}
          data-cy='popinFixed__header__button__close'
          title={t('Close')}
        >
          <i className='fas fa-times' />
        </div>
      </div>
    )
  }
}

export default translate()(appContentFactory(PopinFixedHeader))

PopinFixedHeader.propTypes = {
  faIcon: PropTypes.string.isRequired,
  onClickCloseBtn: PropTypes.func.isRequired,
  customClass: PropTypes.string,
  customColor: PropTypes.string,
  rawTitle: PropTypes.string,
  componentTitle: PropTypes.element,
  userRoleIdInWorkspace: PropTypes.number,
  onValidateChangeTitle: PropTypes.func,
  disableChangeTitle: PropTypes.bool,
  showChangeTitleButton: PropTypes.bool
}

PopinFixedHeader.defaultProps = {
  customClass: '',
  customColor: '',
  rawTitle: '',
  componentTitle: <div />,
  userRoleIdInWorkspace: ROLE.reader.id,
  onChangeTitle: () => {},
  disableChangeTitle: false,
  showChangeTitleButton: true
}

import React from 'react'
import { shallow } from 'enzyme'
import { Thread } from '../../src/container/Thread.jsx'
import { expect } from 'chai'
import sinon from 'sinon'
import {
  mockGetThreadContent200,
  mockGetThreadComment200,
  mockGetThreadRevision200,
  mockPutMyselfThreadRead200
} from '../apiMock.js'
import { contentThread } from '../fixture/contentThread.js'
import { author } from 'tracim_frontend_lib/dist/tracim_frontend_lib.test_utils.js'
import { debug } from '../../src/debug.js'

debug.config.apiUrl = 'http://unit.test:6543/api'

describe('<Thread />', () => {
  const props = {
    setApiUrl: () => {},
    buildTimelineFromCommentAndRevision: (commentList, revisionList) => [...commentList, ...revisionList],
    addCommentToTimeline: sinon.spy((comment, timeline, loggedUser) => timeline),
    loadTimeline: () => {},
    registerLiveMessageHandlerList: () => {},
    registerCustomEventHandlerList: () => {},

    i18n: {},
    content: contentThread,
    loggedUser: {
      userId: 1
    },
    t: key => key,
    isContentInFavoriteList: () => false,
    loadFavoriteContentList: () => {},
    data: debug,
    timeline: []
  }
  const buildBreadcrumbsSpy = sinon.spy()
  const setHeadTitleSpy = sinon.spy()

  mockGetThreadContent200(debug.config.apiUrl, contentThread.thread.workspace_id, contentThread.thread.content_id, contentThread.thread)
  mockPutMyselfThreadRead200(debug.config.apiUrl, props.loggedUser.userId, contentThread.thread.workspace_id, contentThread.thread.content_id)
  mockGetThreadComment200(debug.config.apiUrl, contentThread.thread.workspace_id, contentThread.thread.content_id, contentThread.commentList)
  mockGetThreadRevision200(debug.config.apiUrl, contentThread.thread.workspace_id, contentThread.thread.content_id, contentThread.revisionList)

  const wrapper = shallow(<Thread {...props} />)
  wrapper.instance().buildBreadcrumbs = buildBreadcrumbsSpy
  wrapper.instance().setHeadTitle = setHeadTitleSpy

  const resetSpiesHistory = () => {
    buildBreadcrumbsSpy.resetHistory()
    setHeadTitleSpy.resetHistory()
  }

  describe('TLM Handlers', () => {
    describe('eventType content', () => {
      const baseRevisionTlm = {
        author: author,
        content: contentThread.thread
      }

      describe('handleContentChanged', () => {
        describe('Modify the label of the current content', () => {
          const tlmData = {
            fields: {
              ...baseRevisionTlm,
              content: {
                ...baseRevisionTlm.content,
                label: 'new label'
              },
              client_token: wrapper.state('config').apiHeader['X-Tracim-ClientToken']
            }
          }

          before(() => {
            resetSpiesHistory()
            wrapper.instance().handleContentChanged(tlmData)
          })

          after(() => {
            resetSpiesHistory()
          })

          it('should update the state label', () => {
            expect(wrapper.state('newContent').label).to.equal(tlmData.fields.content.label)
          })
          it('should call buildBreadcrumbs()', () => {
            expect(buildBreadcrumbsSpy.called).to.equal(true)
          })
          it('should call setHeadTitle() with the right args', () => {
            expect(setHeadTitleSpy.calledOnceWith(tlmData.fields.content.label)).to.equal(true)
          })
        })

        describe('Modify the description of the current content', () => {
          const tlmData = {
            fields: {
              ...baseRevisionTlm,
              content: {
                ...contentThread.thread,
                raw_content: 'new random description'
              }
            }
          }

          before(() => {
            wrapper.instance().handleContentChanged(tlmData)
          })

          it('should update the state "raw_content"', () => {
            expect(wrapper.state('newContent').raw_content).to.equal(tlmData.fields.content.raw_content)
          })
        })

        describe('Modify a content not related to the current thread', () => {
          const tlmData = {
            fields: {
              ...baseRevisionTlm,
              content: {
                ...baseRevisionTlm.content,
                content_id: contentThread.thread.content_id + 1
              }
            }
          }

          before(() => {
            wrapper.instance().handleContentChanged(tlmData)
          })

          it('should not update the state', () => {
            expect(wrapper.state('content').content_id).to.not.equal(tlmData.fields.content.content_id)
          })
        })

        describe('Delete the current content', () => {
          const tlmData = {
            fields: {
              ...baseRevisionTlm,
              content: { ...baseRevisionTlm.content, is_deleted: true }
            }
          }

          before(() => {
            wrapper.instance().handleContentChanged(tlmData)
          })

          after(() => {
            wrapper.setState({ content: contentThread.thread })
          })

          it('should update the is_deleted property', () => {
            expect(wrapper.state('newContent').is_deleted).to.equal(true)
          })
        })

        describe('Delete a content which is not the current one', () => {
          const tlmData = {
            fields: {
              ...baseRevisionTlm,
              content: {
                ...baseRevisionTlm.content,
                content_id: contentThread.thread.content_id + 1,
                is_deleted: true
              }
            }
          }

          before(() => {
            wrapper.instance().handleContentChanged(tlmData)
          })

          it('should not update the state', () => {
            expect(wrapper.state('content').is_deleted).to.equal(false)
          })
        })

        describe('Restore the current content', () => {
          const tlmData = {
            fields: {
              ...baseRevisionTlm,
              content: { ...baseRevisionTlm.content, is_deleted: false }
            }
          }

          before(() => {
            wrapper.setState(prev => ({ content: { ...prev.content, is_deleted: true } }))
            wrapper.instance().handleContentChanged(tlmData)
          })

          after(() => {
            wrapper.setState({ content: contentThread.thread })
          })

          it('should update the state is_deleted', () => {
            expect(wrapper.state('newContent').is_deleted).to.equal(false)
          })
        })

        describe('Restore a content which is not the current one', () => {
          const tlmData = {
            fields: {
              ...baseRevisionTlm,
              content: {
                ...baseRevisionTlm.content,
                content_id: contentThread.thread.content_id + 1,
                is_deleted: false
              }
            }
          }

          before(() => {
            wrapper.setState(prev => ({ content: { ...prev.content, is_deleted: true } }))
            wrapper.instance().handleContentChanged(tlmData)
          })

          it('should not update the state', () => {
            expect(wrapper.state('content').is_deleted).to.equal(true)
          })
        })
      })
    })
  })

  describe('its internal functions', () => {
    describe('handleClickRefresh', () => {
      it('should update content state', () => {
        wrapper.setState(prev => ({ newContent: { ...prev.content, label: 'New Name' } }))
        wrapper.instance().handleClickRefresh()
        expect(wrapper.state('content')).to.deep.equal(wrapper.state('newContent'))
      })

      it('should update showRefreshWarning state', () => {
        wrapper.instance().handleClickRefresh()
        expect(wrapper.state('showRefreshWarning')).to.deep.equal(false)
      })
    })
  })
})

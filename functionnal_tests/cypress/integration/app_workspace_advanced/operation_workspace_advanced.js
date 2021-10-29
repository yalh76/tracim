import { SELECTORS as s } from '../../support/generic_selector_commands'
import { PAGES as p } from '../../support/urls_commands'

describe('App Workspace Advanced', function () {
  const newDescription = 'description'
  let workspaceId = 1

  before(() => {
    cy.resetDB()
    cy.setupBaseDB()
    cy.fixture('baseWorkspace').as('workspace').then(workspace => {
      workspaceId = workspace.workspace_id
    })
  })

  beforeEach(function () {
    cy.loginAs('administrators')
    cy.visitPage({ pageName: p.DASHBOARD, params: { workspaceId } })
    cy.contains('.userstatus__role__text', 'Space manager')
  })

  afterEach(function () {
    cy.cancelXHR()
  })

  describe("Changing the workspace's description", () => {
    it('Should update the description in the dashboard', function () {
      cy.getTag({ selectorName: s.WORKSPACE_DASHBOARD })
        .find('.dashboard__workspace__detail__buttons .iconbutton')
        .click()

      cy.waitForTinyMCELoaded().then(() => {
        cy.clearTinyMCE().then(() => {
          cy.typeInTinyMCE(newDescription).then(() => {
            cy.get('.workspace_advanced__description__bottom__btn')
              .click()

            cy.getTag({ selectorName: s.WORKSPACE_DASHBOARD })
              .find('.dashboard__workspace__detail__description')
              .contains(newDescription)
          })
        })
      })
    })
  })

  describe("Changing the space's default role", () => {
    it('Should show a flash message', function () {
      cy.getTag({ selectorName: s.WORKSPACE_DASHBOARD })
      .find('.dashboard__workspace__detail__buttons .iconbutton')
      .click()

      cy.getTag({ selectorName: s.CONTENT_FRAME })
        .find('.workspace_advanced__defaultRole')
        .should('be.visible')

      cy.getTag({ selectorName: s.CONTENT_FRAME })
        .find('.workspace_advanced__defaultRole__list .singleChoiceList__item')
        .first()
        .click()

      cy.getTag({ selectorName: s.CONTENT_FRAME })
        .find('.workspace_advanced__defaultRole__bottom__btn')
        .click()

      cy.contains('.flashmessage__container__content__text__paragraph', 'Save successful')
    })
  })

  describe('Member list', () => {
    let userId = 0
    let userPublicName = ''
    let userEmail = ''
    let userUsername = ''

    beforeEach(() => {
      cy.loginAs('administrators')
      cy.createRandomUser().then(user => {
        userId = user.user_id
        userPublicName = user.public_name
        userEmail = user.email
        userUsername = user.username
      })
    })

    it('Should be able to add a user with their public name', () => {
      cy.visitPage({ pageName: p.DASHBOARD, params: { workspaceId } })
      cy.contains('.userstatus__role__text', 'Space manager')

      cy.getTag({ selectorName: s.WORKSPACE_DASHBOARD })
        .find('.dashboard__workspace__detail__buttons .iconbutton')
        .click()

      cy.getTag({ selectorName: s.CONTENT_FRAME })
        .find('div.workspace_advanced__userlist__adduser__button')
        .click()

      cy.getTag({ selectorName: s.CONTENT_FRAME })
        .find('#addmember')
        .clear()
        .type(userPublicName)

      cy.getTag({ selectorName: s.CONTENT_FRAME })
        .find('div.autocomplete__item')
        .click()

      cy.getTag({ selectorName: s.CONTENT_FRAME })
        .find('.memberlist__form__role .singleChoiceList__item__radioButton > input')
        .first()
        .click()

      cy.getTag({ selectorName: s.CONTENT_FRAME })
        .find('.memberlist__form__submitbtn > button')
        .click()

      cy.getTag({ selectorName: s.CONTENT_FRAME })
        .find(`.workspace_advanced__userlist__list__item[data-cy=workspace_advanced__member-${userId}]`)
        .should('be.visible')
    })

    it('Should be able to add a user with his email', () => {
      cy.visitPage({ pageName: p.DASHBOARD, params: { workspaceId } })
      cy.contains('.userstatus__role__text', 'Space manager')

      cy.getTag({ selectorName: s.WORKSPACE_DASHBOARD })
        .find('.dashboard__workspace__detail__buttons .iconbutton')
        .click()

      cy.getTag({ selectorName: s.CONTENT_FRAME })
        .find('div.workspace_advanced__userlist__adduser__button')
        .click()

      cy.getTag({ selectorName: s.CONTENT_FRAME })
        .find('#addmember')
        .clear()
        .type(userEmail)

      cy.getTag({ selectorName: s.CONTENT_FRAME })
        .find('div.autocomplete__item')
        .click()

      cy.getTag({ selectorName: s.CONTENT_FRAME })
        .find('.memberlist__form__role .singleChoiceList__item__radioButton > input')
        .first()
        .click()

      cy.getTag({ selectorName: s.CONTENT_FRAME })
        .find('.memberlist__form__submitbtn > button')
        .click()

      cy.getTag({ selectorName: s.CONTENT_FRAME })
        .find(`.workspace_advanced__userlist__list__item[data-cy=workspace_advanced__member-${userId}]`)
        .should('be.visible')
    })

    it('Should be able to add a user with his username', () => {
      cy.visitPage({ pageName: p.DASHBOARD, params: { workspaceId } })
      cy.contains('.userstatus__role__text', 'Space manager')

      cy.getTag({ selectorName: s.WORKSPACE_DASHBOARD })
        .find('.dashboard__workspace__detail__buttons .iconbutton')
        .click()

      cy.getTag({ selectorName: s.CONTENT_FRAME })
        .find('div.workspace_advanced__userlist__adduser__button')
        .click()

      cy.getTag({ selectorName: s.CONTENT_FRAME })
        .find('#addmember')
        .clear()
        .type(userUsername)

      cy.getTag({ selectorName: s.CONTENT_FRAME })
        .find('div.autocomplete__item')
        .click()

      cy.getTag({ selectorName: s.CONTENT_FRAME })
        .find('.memberlist__form__role .singleChoiceList__item__radioButton > input')
        .first()
        .click()

      cy.getTag({ selectorName: s.CONTENT_FRAME })
        .find('.memberlist__form__submitbtn > button')
        .click()

      cy.getTag({ selectorName: s.CONTENT_FRAME })
        .find(`.workspace_advanced__userlist__list__item[data-cy=workspace_advanced__member-${userId}]`)
        .should('be.visible')
    })

    it('Should not display disabled user(s)', () => {
      cy.disableUser(userId)
      cy.visitPage({ pageName: p.DASHBOARD, params: { workspaceId } })
      cy.contains('.userstatus__role__text', 'Space manager')

      cy.getTag({ selectorName: s.WORKSPACE_DASHBOARD })
        .find('.dashboard__workspace__detail__buttons .iconbutton')
        .click()

      cy.getTag({ selectorName: s.CONTENT_FRAME })
        .find(`.workspace_advanced__userlist__list__item[data-cy=workspace_advanced__member-${userId}]`)
        .should('be.not.visible')

      cy.enableUser(userId)
    })
  })

  describe('Optional features', () => {
    beforeEach(() => {
      cy.loginAs('administrators')
      cy.visitPage({ pageName: p.DASHBOARD, params: { workspaceId } })
      cy.contains('.userstatus__role__text', 'Space manager')
      cy.getTag({ selectorName: s.WORKSPACE_DASHBOARD })
        .find('.dashboard__workspace__detail__buttons .iconbutton')
        .click()
    })
    const testCases = [
      {
        feature: 'news',
        buttonSelector: '[data-cy=publication_enabled]',
        deactivatedMessage: 'News deactivated',
        activatedMessage: 'News activated'
      },
      {
        feature: 'agenda',
        buttonSelector: '[data-cy=agenda_enabled]',
        deactivatedMessage: 'Agenda deactivated',
        activatedMessage: 'Agenda activated'
      },
      {
        feature: 'download',
        buttonSelector: '[data-cy=download_enabled]',
        deactivatedMessage: 'Download deactivated',
        activatedMessage: 'Download activated'
      },
      {
        feature: 'upload',
        buttonSelector: '[data-cy=upload_enabled]',
        deactivatedMessage: 'Upload deactivated',
        activatedMessage: 'Upload activated'
      }
    ]
    for (const testCase of testCases) {
      it(`should allow to toggle ${testCase.feature}`, () => {
        cy.get('[data-cy=popin_right_part_optional_functionalities]').click()
        cy.get('.wsContentGeneric__content__right__content__title').should('be.visible')
        cy.contains(`${testCase.buttonSelector}`, testCase.activatedMessage)
        cy.get(`${testCase.buttonSelector} > .btnswitch > .switch > .slider`).click()
        cy.contains(`${testCase.buttonSelector}`, testCase.deactivatedMessage)
        cy.contains('.flashmessage__container__content__text__paragraph', testCase.deactivatedMessage)
          .should('be.visible')
          .get('.flashmessage__container__close__icon')
          .click()
        cy.get(`${testCase.buttonSelector} > .btnswitch > .switch > .slider`).click()
        cy.contains(`${testCase.buttonSelector}`, testCase.activatedMessage)
        cy.contains('.flashmessage__container__content__text__paragraph', testCase.activatedMessage)
      })
    }
  })
})

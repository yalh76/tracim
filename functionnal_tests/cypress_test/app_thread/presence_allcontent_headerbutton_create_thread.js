import { login, logout } from '../helpers/index.js'

describe('navigate :: workspace > create_new > thread', function () {
    before(function () {
        login(cy)
    })
    after(function() {
        logout (cy)
    })
    it ('allcontent > button', function() {
        cy.visit('/workspaces/1/contents')
        cy.get('.pageTitleGeneric__title__icon').should('be.visible')
        cy.get('#dropdownCreateBtn.workspace__header__btnaddcontent__label').should('be.visible')
        cy.get('#dropdownCreateBtn.workspace__header__btnaddcontent__label').click()
        cy.get('.show .subdropdown__link__thread__icon').should('be.visible')
    })
})

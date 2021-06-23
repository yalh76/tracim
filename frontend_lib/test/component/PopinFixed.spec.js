import React from 'react'
import { expect } from 'chai'
import { mount } from 'enzyme'
import PopinFixed from '../../src/component/PopinFixed/PopinFixed'
import PopinFixedContent from '../../src/component/PopinFixed/PopinFixedContent'
import PopinFixedHeader from '../../src/component/PopinFixed/PopinFixedHeader'
require('../../src/component/PopinFixed/PopinFixed.styl')

describe('<PopinFixed />', () => {
  const props = {
    customClass: 'randomCustomClass',
    visible: false,
    style: {
      color: 'yellow'
    },
    actionList: [],
    componentTitle: <div />,
    config: {
      hexcolor: '',
      faIcon: ''
    },
    content: {
      is_archived: false,
      is_deleted: false
    },
    disableChangeTitle: false,
    favoriteState: '',
    loggedUser: {
      userRoleIdInWorkspace: 0
    },
    onClickCloseBtn: () => { },
    onValidateChangeTitle: () => { },
    showReactions: false
  }

  const wrapper = mount(
    <PopinFixed
      {...props}
    >
      <PopinFixedHeader />
      <PopinFixedContent>
        <div>test</div>
      </PopinFixedContent>
    </PopinFixed>
  )

  describe('Static design', () => {
    it('should have the class visible when props.visible is set to true', () => {
      wrapper.setProps({ visible: true })
      expect(wrapper.find('.visible').length).to.equal(1)
    })

    it('should not have the class visible when props.visible is set to false', () => {
      wrapper.setProps({ visible: false })
      expect(wrapper.find('.visible').length).to.equal(0)
    })
  })
})

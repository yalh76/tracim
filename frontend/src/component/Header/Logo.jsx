import React from 'react'
import PropTypes from 'prop-types'
import { Link } from 'react-router-dom'

const Logo = props => {
  return (
    <Link className='header__logo navbar-brand' to={props.to}>
      <img className='header__logo__img' src={props.logoSrc} />
    </Link>
  )
}
export default Logo

Logo.propTypes = {
  logoSrc: PropTypes.string.isRequired,
  to: PropTypes.string
}

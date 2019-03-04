import React from 'react'
import h from 'lib/ui/hyperscript_with_helpers'
import { connect } from 'react-redux'
import { push } from 'react-router-redux'
import { Link } from 'react-router'
import Spinner from 'components/shared/spinner'
import { OnboardOverlay } from 'components/onboard'
import { selectAccount, logout, resetSession } from 'actions'
import { getAccounts, getAccountPrivkeysById } from 'selectors'
import { imagePath, setAuthenticatingOverlay } from 'lib/ui'
import R from 'ramda'

const SelectAccount = ({
  accounts,
  accountPrivkeys,
  onSelect,
  onRemove,
  onResetSession,
}) => {
  const renderSelectButton = auth => {
      return (
        <button
          onClick={e => onSelect({ auth, privkey: accountPrivkeys[auth.id] })}
        >
          {' '}
          Sign In{' '}
        </button>
      )
    },
    renderAccount = (account, i) => {
      return (
        <div key={i || false} className={i % 2 == 0 ? 'even' : 'odd'}>
          <img
            className="remove"
            src={imagePath('remove-circle-black.png')}
            onClick={() => onRemove(account.id)}
          />
          <label>{account.uid}</label>
          {renderSelectButton(account)}
        </div>
      )
    },
    renderAccountSelect = () => {
      return (
        <div className="select-candidates account-candidates">
          {accounts.map(renderAccount)}
        </div>
      )
    },
    renderAddAccount = () => {
      return (
        <Link
          to="/login"
          className="button secondary-button add-account"
          onClick={() => onResetSession()}
        >
          <img src={imagePath('plus-sign-blue.svg')} />
          <label>Add An Account</label>
        </Link>
      )
    },
    renderBackLink = () => {
      return h(Link, { className: 'back-link', to: '/home' }, [
        h.span('.img', '←'),
        h.span('Back To Home'),
      ])
    }

  return (
    <OnboardOverlay>
      <div className="onboard-auth-form select-account">
        <h1>
          Select An <em>Account</em>
        </h1>
        {renderAccountSelect()}
        {renderAddAccount()}
        {renderBackLink()}
      </div>
    </OnboardOverlay>
  )
}

const mapStateToProps = state => {
  return {
    accounts: getAccounts(state),
    accountPrivkeys: getAccountPrivkeysById(state),
  }
}

const mapDispatchToProps = dispatch => {
  return {
    onRemove: accountId => dispatch(logout({ accountId })),
    onResetSession: () => dispatch(resetSession()),
    onSelect: params => {
      setAuthenticatingOverlay()
      dispatch(selectAccount(params))
    },
  }
}

export default connect(
  mapStateToProps,
  mapDispatchToProps
)(SelectAccount)

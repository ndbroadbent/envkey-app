import { connect } from 'react-redux'
import { push } from 'react-router-redux'
import SelectOrg from 'components/shared/select_org'
import { selectOrg } from 'actions'
import { getCurrentOrg, getOrgs, getIsFetchingOrg } from 'selectors'
import R from 'ramda'

const mapStateToProps = state => {
  return {
    isFetchingOrg: getIsFetchingOrg(state),
    currentOrg: getCurrentOrg(state),
    orgs: getOrgs(state),
  }
}

const mapDispatchToProps = dispatch => {
  return {
    onSelect: slug => {
      if (!document.body.className.includes('preloader-authenticate')) {
        document.body.className += ' preloader-authenticate'
      }
      document.getElementById('preloader-overlay').className = 'full-overlay'
      dispatch(selectOrg(slug))
    },
  }
}

export default connect(
  mapStateToProps,
  mapDispatchToProps
)(SelectOrg)

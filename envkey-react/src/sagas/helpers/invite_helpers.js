import R from 'ramda'
import { put, take, select, call } from 'redux-saga/effects'
import {
  execCreateObject,
  execAddAssoc,
  dispatchCreateAssocSuccess,
  dispatchCreateAssocFailed,
  checkPubkeyIsValid,
} from '.'
import {
  GENERATE_INVITE_LINK,
  GENERATE_INVITE_LINK_SUCCESS,
  GENERATE_INVITE_LINK_FAILED,
  CHECK_EMAIL_EXISTS_REQUEST,
  CHECK_EMAIL_EXISTS_SUCCESS,
  CHECK_EMAIL_EXISTS_FAILED,
  GRANT_ENV_ACCESS,
  GRANT_ENV_ACCESS_SUCCESS,
  GRANT_ENV_ACCESS_FAILED,
  INVITE_USER,
  INVITE_USER_SUCCESS,
  INVITE_USER_FAILED,
  FETCH_CURRENT_USER_UPDATES_SUCCESS,
  addTrustedPubkey,
  updateTrustedPubkeys,
  fetchCurrentUserUpdates,
} from 'actions'
import {
  getCurrentOrg,
  getInviteePubkey,
  getPrivkey,
  getUserByEmail,
} from 'selectors'
import { sha256 } from 'lib/crypto'

function* generateInviteLink(action) {
  yield put({ ...action, type: GENERATE_INVITE_LINK })
  const res = yield take([
    GENERATE_INVITE_LINK_SUCCESS,
    GENERATE_INVITE_LINK_FAILED,
  ])
  return res
}

function* dispatchGrantEnvAccess({ payload, meta: { parentId } }) {
  yield put({
    type: GRANT_ENV_ACCESS,
    payload,
    meta: { isInvite: true, parentId },
  })
}

function* execGrantEnvAccess({ payload, meta }) {
  yield call(dispatchGrantEnvAccess, { payload, meta })
  const res = yield take([GRANT_ENV_ACCESS_SUCCESS, GRANT_ENV_ACCESS_FAILED])
  return res
}

export function* inviteUser(action) {
  const { meta, payload } = action,
    existingUser = yield select(getUserByEmail(payload.user.email)),
    isReinvite = existingUser && existingUser.deleted

  yield put({
    ...R.assocPath(['meta', 'isReinvite'], isReinvite, action),
    type: INVITE_USER,
  })

  yield put(fetchCurrentUserUpdates())
  yield take(FETCH_CURRENT_USER_UPDATES_SUCCESS)

  const { id: orgId } = yield select(getCurrentOrg)
  let createPayload

  if (!isReinvite) {
    const { error: generateInviteLinkError, payload: inviteLink } = yield call(
      generateInviteLink,
      action
    )
    if (generateInviteLinkError) {
      yield put({
        meta,
        type: INVITE_USER_FAILED,
        error: generateInviteLinkError,
        payload: inviteLink,
      })
      return
    }
    createPayload = { ...payload, inviteLink }
  } else {
    createPayload = payload
  }

  const createRes = yield call(execCreateObject, {
    ...action,
    payload: createPayload,
  })

  if (createRes.error) {
    const status = R.path(['payload', 'response', 'status'], createRes),
      errorType = R.path(
        ['payload', 'response', 'data', 'errors', 0, 'type'],
        createRes
      )

    if (status == 422) {
      const msg = {
        already_org_member:
          'This user is already a member of your organization.',
        already_invited: 'This user already has a pending invitation.',
      }[errorType]

      if (msg) {
        alert(msg)
      }
    }

    yield call(dispatchCreateAssocFailed, { failAction: createRes, meta })
    yield put({ ...createRes, meta, type: INVITE_USER_FAILED })
    return
  }

  if (!isReinvite) {
    yield put(
      addTrustedPubkey({
        keyable: { type: 'user', ...createRes.payload },
        orgId,
      })
    )
  }

  const addRes = yield call(execAddAssoc, action, createRes.payload.id, true)

  if (addRes.error) {
    yield call(dispatchCreateAssocFailed, { failAction: addRes, meta })
    yield put({ ...addRes, type: INVITE_USER_FAILED })
    return
  }

  yield call(dispatchCreateAssocSuccess, action)

  let grantEnvAccessRes
  if (payload.user.orgRole == 'org_admin') {
    grantEnvAccessRes = yield call(execGrantEnvAccess, {
      payload: [{ ...createRes.payload, userId: createRes.payload.id }],
      meta,
    })
  }

  if (grantEnvAccessRes && grantEnvAccessRes.error) {
    yield put({ ...grantEnvAccessRes, type: INVITE_USER_FAILED })
    return
  }

  const toDispatch = [put({ ...action, type: INVITE_USER_SUCCESS })]
  if (!isReinvite) toDispatch.unshift(put(updateTrustedPubkeys()))

  yield toDispatch
}

export function* checkInviteePubkeyIsValid() {
  const privkey = yield select(getPrivkey),
    pubkey = yield select(getInviteePubkey),
    valid = yield call(checkPubkeyIsValid, { privkey, pubkey })

  return valid
}

export const getIdentityHash = R.pipe(
  R.pick(['pubkeyFingerprint', 'org', 'invitedBy', 'invitee']),
  R.evolve({
    org: R.pick(['id', 'name']),
    invitedBy: R.pick(['email', 'pubkeyFingerprint']),
    invitee: R.pick(['email']),
  }),
  JSON.stringify,
  sha256
)

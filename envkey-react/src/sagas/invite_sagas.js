import R from 'ramda'
import {
  takeLatest,
  takeEvery,
  put,
  select,
  call,
  take,
} from 'redux-saga/effects'
import { push } from 'react-router-redux'
import { delay } from 'redux-saga'
import {
  apiSaga,
  getIdentityHash,
  execDecryptPrivkey,
  execVerifyTrustedPubkeys,
  execVerifyOrgPubkeys,
  envParamsForAcceptedInvite,
  signTrustedPubkeys,
  checkInviteePubkeyIsValid,
  envParamsForInvitee,
  redirectFromOrgIndexIfNeeded,
  decryptPrivkeyAndDecryptAllIfNeeded,
  execAddAssoc,
} from './helpers'
import {
  getInviteParams,
  getInviteIdentityHash,
  getInvitePassphrase,
  getEmailVerificationCode,
  getPrivkey,
  getCurrentOrg,
  getCurrentUser,
  getInviteeEncryptedPrivkey,
  getOrgUserForUser,
  getUser,
  getAppUserBy,
  getAppsForUser,
} from 'selectors'
import {
  decryptPrivateKey,
  signPublicKey,
  getPubkeyFingerprint,
  secureRandomAlphanumeric,
  generateKeys,
} from 'lib/crypto'
import {
  GENERATE_INVITE_LINK,
  GENERATE_INVITE_LINK_SUCCESS,
  GENERATE_INVITE_LINK_FAILED,
  LOAD_INVITE_REQUEST,
  LOAD_INVITE_API_SUCCESS,
  LOAD_INVITE_SUCCESS,
  LOAD_INVITE_FAILED,
  REFRESH_INVITE_REQUEST,
  REFRESH_INVITE_API_SUCCESS,
  REFRESH_INVITE_SUCCESS,
  REFRESH_INVITE_FAILED,
  VERIFY_INVITE_PARAMS,
  VERIFY_INVITE_PARAMS_SUCCESS,
  VERIFY_INVITE_PARAMS_FAILED,
  ACCEPT_INVITE,
  ACCEPT_INVITE_REQUEST,
  ACCEPT_INVITE_SUCCESS,
  ACCEPT_INVITE_API_FAILED,
  ACCEPT_INVITE_FAILED,
  REVOKE_INVITE,
  REVOKE_INVITE_SUCCESS,
  REVOKE_INVITE_FAILED,
  REGEN_INVITE,
  REGEN_INVITE_SUCCESS,
  REGEN_INVITE_FAILED,
  DECRYPT_ALL,
  DECRYPT_ALL_SUCCESS,
  DECRYPT_ALL_FAILED,
  GENERATE_USER_KEYPAIR,
  GENERATE_USER_KEYPAIR_SUCCESS,
  GRANT_ENV_ACCESS,
  GRANT_ENV_ACCESS_REQUEST,
  GRANT_ENV_ACCESS_FAILED,
  GRANT_ENV_ACCESS_SUCCESS,
  LOGIN_REQUEST,
  DECRYPT_PRIVKEY_SUCCESS,
  SOCKET_SUBSCRIBE_ORG_CHANNEL,
  SELECT_ORG,
  REMOVE_OBJECT_SUCCESS,
  REMOVE_OBJECT_FAILED,
  CREATE_ASSOC_SUCCESS,
  CREATE_ASSOC_FAILED,
  INVITE_EXISTING_USER_INVALID_PASSPHRASE,
  verifyInviteParams,
  acceptInvite,
  acceptInviteRequest,
  loadInviteRequest,
  refreshInviteRequest,
  addTrustedPubkey,
  grantEnvAccessRequest,
  decryptPrivkey,
  selectOrg,
  removeObject,
  createAssoc,
  addAssoc,
  fetchCurrentUserUpdates,
} from 'actions'

const onLoadInviteRequest = apiSaga({
    authenticated: false, // authenticated through invite params instead of token auth
    skipOrg: true,
    method: 'get',
    actionTypes: [LOAD_INVITE_API_SUCCESS, LOAD_INVITE_FAILED],
    urlFn: ({ meta: { identityHash } }) => `/invite_links/${identityHash}.json`,
  }),
  onRefreshInviteRequest = apiSaga({
    authenticated: false, // authenticated through invite params instead of token auth
    skipOrg: true,
    method: 'get',
    actionTypes: [REFRESH_INVITE_API_SUCCESS, REFRESH_INVITE_FAILED],
    urlFn: ({ meta: { identityHash } }) =>
      `/invite_links/${identityHash}/refresh.json`,
  }),
  onAcceptInviteRequest = apiSaga({
    authenticated: false, // authenticated through invite params instead of token auth
    skipOrg: true,
    method: 'post',
    actionTypes: [ACCEPT_INVITE_SUCCESS, ACCEPT_INVITE_API_FAILED],
    urlFn: ({ meta: { identityHash } }) =>
      `/invite_links/${identityHash}/accept_invite.json`,
  }),
  onGrantEnvAccessRequest = apiSaga({
    authenticated: true,
    method: 'patch',
    actionTypes: [GRANT_ENV_ACCESS_SUCCESS, GRANT_ENV_ACCESS_FAILED],
    urlFn: action =>
      `/org_users/${action.meta.orgUserId}/grant_env_access.json`,
  })

function* onLoadOrRefreshInviteApiSuccess(action) {
  const [successAction, failAction] = {
    [LOAD_INVITE_API_SUCCESS]: [LOAD_INVITE_SUCCESS, LOAD_INVITE_FAILED],
    [REFRESH_INVITE_API_SUCCESS]: [
      REFRESH_INVITE_SUCCESS,
      REFRESH_INVITE_FAILED,
    ],
  }[action.type]

  yield put(verifyInviteParams())
  const res = yield take([
    VERIFY_INVITE_PARAMS_SUCCESS,
    VERIFY_INVITE_PARAMS_FAILED,
  ])

  if (res.error) {
    yield put({ ...res, type: failAction })
  } else {
    let err
    const invitePassphrase = yield select(getInvitePassphrase),
      decryptPrivkeyResult = yield call(execDecryptPrivkey, invitePassphrase)

    if (!decryptPrivkeyResult.error) {
      const pubkeyValid = yield call(checkInviteePubkeyIsValid)

      if (pubkeyValid) {
        const verifyTrustedPubkeysResult = yield call(execVerifyTrustedPubkeys)
        if (!verifyTrustedPubkeysResult.error) {
          const verifyOrgPubkeysResult = yield call(execVerifyOrgPubkeys)
          if (!verifyOrgPubkeysResult.error) {
            yield put({
              type: DECRYPT_ALL,
              meta: { skipVerifyCurrentUser: true },
            })
            const decryptAllRes = yield take([
              DECRYPT_ALL_SUCCESS,
              DECRYPT_ALL_FAILED,
            ])
            if (decryptAllRes.error) {
              err = decryptAllRes.payload
            }
          } else {
            err = verifyOrgPubkeysResult.payload
          }
        } else {
          err = verifyTrustedPubkeysResult.error
        }
      } else {
        err = 'Pubkey invalid.'
      }
    } else {
      err = decryptPrivkeyResult.payload
    }

    if (err) {
      yield put({ type: failAction, error: true, payload: err })
    } else {
      yield put({ type: successAction, meta: action.meta })
    }
  }
}

function* onVerifyInviteParams(action) {
  const inviteParams = yield select(getInviteParams),
    identityHash = yield select(getInviteIdentityHash),
    serverIdentityHash = getIdentityHash(inviteParams),
    isValid = serverIdentityHash === identityHash

  if (isValid) {
    yield put({ type: VERIFY_INVITE_PARAMS_SUCCESS })
  } else {
    yield put({
      type: VERIFY_INVITE_PARAMS_FAILED,
      error: true,
      payload: new Error('Invite parameters invalid.'),
    })
  }
}

function* onAcceptInvite({ payload, meta }) {
  document.body.className += ' preloader-authenticate'

  const { password } = payload,
    identityHash = yield select(getInviteIdentityHash),
    invitePassphrase = yield select(getInvitePassphrase),
    inviteParams = yield select(getInviteParams),
    emailVerificationCode = yield select(getEmailVerificationCode),
    { id: orgId, slug: orgSlug } = yield select(getCurrentOrg),
    currentUser = yield select(getCurrentUser)

  let pubkey, encryptedPrivkey

  if (inviteParams.invitee.pubkey) {
    // Existing user being added to org
    pubkey = inviteParams.invitee.pubkey
    encryptedPrivkey = yield select(getInviteeEncryptedPrivkey)
  } else {
    // New user
    yield put({
      type: GENERATE_USER_KEYPAIR,
      payload: { password, email: inviteParams.invitee.email },
    })
    const res = yield take(GENERATE_USER_KEYPAIR_SUCCESS)
    pubkey = res.payload.pubkey
    encryptedPrivkey = res.payload.encryptedPrivkey
  }

  const pubkeyFingerprint = getPubkeyFingerprint(pubkey),
    user = {
      pubkey,
      encryptedPrivkey,
      pubkeyFingerprint,
    },
    invitePrivkey = yield select(getPrivkey)

  let decryptedPrivkey

  try {
    decryptedPrivkey = yield decryptPrivateKey({
      privkey: encryptedPrivkey,
      passphrase: password,
    })
  } catch (e) {
    yield put({
      type: INVITE_EXISTING_USER_INVALID_PASSPHRASE,
      error: true,
      payload: e,
      meta: meta,
    })
    return
  }

  const signedPubkey = yield signPublicKey({ pubkey, privkey: invitePrivkey })

  yield put(
    addTrustedPubkey({
      orgId,
      keyable: {
        type: 'user',
        ...currentUser,
        invitePubkey: inviteParams.pubkey,
        invitePubkeyFingerprint: inviteParams.invitePubkeyFingerprint,
        pubkey: signedPubkey,
        pubkeyFingerprint,
      },
    })
  )

  const signedTrustedPubkeys = yield call(signTrustedPubkeys, decryptedPrivkey)

  yield put(
    acceptInviteRequest({
      password, //gets added to meta, not payload (doesn't go to server)
      emailVerificationCode,
      identityHash,
      user,
      orgSlug,
      inviteUpdatedAt: inviteParams.inviteUpdatedAt,
      email: inviteParams.invitee.email,
      orgUser: { signedTrustedPubkeys, pubkey: signedPubkey },
      envs: yield call(envParamsForAcceptedInvite, signedPubkey),
      currentUserId: currentUser.id,
    })
  )
}

function* onAcceptInviteApiFailed(action) {
  const { payload, meta } = action
  if ((R.pathEq(['response', 'data', 'error'], 'Outdated resource'), payload)) {
    yield put(
      refreshInviteRequest({
        emailVerificationCode: meta.requestPayload.emailVerificationCode,
        identityHash: meta.identityHash,
      })
    )

    const res = yield take([REFRESH_INVITE_SUCCESS, REFRESH_INVITE_FAILED])

    if (res.error) {
      yield put({ ...res, type: ACCEPT_INVITE_FAILED })
    } else {
      yield put(acceptInvite({ password: meta.password }))
    }
  } else {
    yield put({ ...action, type: ACCEPT_INVITE_FAILED })
  }
}

function* onAcceptInviteSuccess({ meta: { password, orgSlug } }) {
  const currentOrg = yield select(getCurrentOrg),
    res = yield call(decryptPrivkeyAndDecryptAllIfNeeded, password)

  yield put(push(`/${currentOrg.slug}`))
  yield put({ type: SOCKET_SUBSCRIBE_ORG_CHANNEL })
  yield call(redirectFromOrgIndexIfNeeded)

  const overlay = document.getElementById('preloader-overlay')
  overlay.className += ' hide'
}

function* onGenerateInviteLink(action) {
  try {
    const { meta, payload } = action,
      currentOrg = yield select(getCurrentOrg),
      currentUser = yield select(getCurrentUser),
      passphrase = secureRandomAlphanumeric(16),
      {
        privateKeyArmored: encryptedPrivkey,
        publicKeyArmored: pubkey,
      } = yield generateKeys({
        email: [currentOrg.slug, 'invite-link', payload.user.email].join('-'),
        passphrase,
      }),
      decryptedPrivkey = yield decryptPrivateKey({
        privkey: encryptedPrivkey,
        passphrase,
      }),
      currentUserPrivkey = yield select(getPrivkey),
      signedPubkey = yield signPublicKey({
        pubkey,
        privkey: currentUserPrivkey,
      }),
      pubkeyFingerprint = getPubkeyFingerprint(signedPubkey),
      signedTrustedPubkeys = yield call(signTrustedPubkeys, decryptedPrivkey),
      identityHash = getIdentityHash({
        pubkeyFingerprint,
        invitedBy: currentUser,
        invitee: payload.user,
        org: currentOrg,
      })

    yield put({
      type: GENERATE_INVITE_LINK_SUCCESS,
      meta: { ...meta, passphrase, identityHash, user: payload.user },
      payload: {
        identityHash,
        encryptedPrivkey,
        pubkeyFingerprint,
        signedTrustedPubkeys,
        pubkey: signedPubkey,
      },
    })
  } catch (e) {
    yield put({
      type: GENERATE_INVITE_LINK_FAILED,
      meta: action.meta,
      error: true,
      payload: e,
    })
  }
}

function* onRevokeInvite({ payload: { userId } }) {
  const orgUser = yield select(getOrgUserForUser(userId))
  yield put(
    removeObject({
      objectType: 'orgUser',
      targetId: orgUser.id,
      noRedirect: true,
      revokeInvite: true,
    })
  )

  const res = yield take([REMOVE_OBJECT_SUCCESS, REMOVE_OBJECT_FAILED])

  if (res.error) {
    yield put({
      type: REVOKE_INVITE_FAILED,
      error: true,
      payload: res.payload,
      meta: { userId },
    })

    if (R.pathEq(['payload', 'response', 'data', 'error'], 'invite_accepted')) {
      yield put(fetchCurrentUserUpdates())
    }

    return
  }

  yield put({ type: REVOKE_INVITE_SUCCESS, meta: { userId } })
}

function* onRegenInvite(action) {
  let res
  const {
      payload: { userId },
      meta: { appId },
    } = action,
    user = yield select(getUser(userId)),
    appUser = yield select(getAppUserBy({ appId, userId })),
    userApps = yield select(getAppsForUser(userId))

  yield put({ ...action, type: REVOKE_INVITE })

  res = yield take([REVOKE_INVITE_SUCCESS, REVOKE_INVITE_FAILED])

  if (res.error) {
    yield put({
      type: REGEN_INVITE_FAILED,
      error: true,
      payload: res.payload,
      meta: { userId },
    })
    return
  }

  yield put(
    createAssoc({
      params: {
        ...R.pick(['firstName', 'lastName', 'email'], user),
        role: appUser.role,
        orgRole: user.role,
      },
      role: appUser.role,
      parentType: 'app',
      assocType: 'user',
      joinType: 'appUser',
      isManyToMany: true,
      parentId: appId,
    })
  )

  res = yield take([CREATE_ASSOC_SUCCESS, CREATE_ASSOC_FAILED])

  if (res.error) {
    yield put({
      type: REVOKE_INVITE_FAILED,
      error: true,
      payload: res.payload,
      meta: { userId },
    })
  }

  for (let app of userApps) {
    if (app.id == appId) continue

    let role = app.relation.role
    yield put(
      addAssoc({
        role,
        parentType: 'app',
        assocType: 'user',
        joinType: 'appUser',
        isManyToMany: true,
        parentId: app.id,
        assocId: userId,
      })
    )
  }

  yield put({ type: REGEN_INVITE_SUCCESS, meta: { userId } })
}

function* onGrantEnvAccess({ payload: invitees, meta }) {
  for (let invitee of invitees) {
    let inviteeEnvParams = yield call(envParamsForInvitee, invitee)

    yield put(
      grantEnvAccessRequest({
        ...inviteeEnvParams,
        ...meta,
        ...R.pick(['orgUserId', 'userId'], invitee),
      })
    )
  }
}

export default function* inviteSagas() {
  yield [
    takeLatest(LOAD_INVITE_REQUEST, onLoadInviteRequest),
    takeLatest(REFRESH_INVITE_REQUEST, onRefreshInviteRequest),
    takeLatest(
      [LOAD_INVITE_API_SUCCESS, REFRESH_INVITE_API_SUCCESS],
      onLoadOrRefreshInviteApiSuccess
    ),
    takeLatest(VERIFY_INVITE_PARAMS, onVerifyInviteParams),
    takeLatest(ACCEPT_INVITE, onAcceptInvite),
    takeLatest(ACCEPT_INVITE_REQUEST, onAcceptInviteRequest),
    takeLatest(ACCEPT_INVITE_SUCCESS, onAcceptInviteSuccess),
    takeLatest(ACCEPT_INVITE_API_FAILED, onAcceptInviteApiFailed),
    takeEvery(GENERATE_INVITE_LINK, onGenerateInviteLink),
    takeEvery(GRANT_ENV_ACCESS, onGrantEnvAccess),
    takeEvery(GRANT_ENV_ACCESS_REQUEST, onGrantEnvAccessRequest),
    takeEvery(REVOKE_INVITE, onRevokeInvite),
    takeEvery(REGEN_INVITE, onRegenInvite),
  ]
}

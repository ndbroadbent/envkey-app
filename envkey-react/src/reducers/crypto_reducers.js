import R from 'ramda'

import {
  LOGIN,
  LOGIN_REQUEST,
  LOGIN_SUCCESS,

  REGISTER,
  REGISTER_SUCCESS,

  LOGOUT,
  SELECT_ORG,

  FETCH_CURRENT_USER_REQUEST,
  FETCH_CURRENT_USER_SUCCESS,

  DECRYPT_PRIVKEY,

  DECRYPT_PRIVKEY_FAILED,
  DECRYPT_PRIVKEY_SUCCESS,

  DECRYPT_ENVS,
  DECRYPT_ENVS_FAILED,
  DECRYPT_ENVS_SUCCESS,

  VERIFY_CURRENT_USER_PUBKEY,
  DECRYPT_ALL,
  DECRYPT_ALL_SUCCESS,

  GENERATE_USER_KEYPAIR,
  GENERATE_USER_KEYPAIR_SUCCESS,

  GENERATE_ASSOC_KEY_SUCCESS,
  CLEAR_GENERATED_ASSOC_KEY,

  VERIFY_TRUSTED_PUBKEYS_SUCCESS,
  VERIFY_TRUSTED_PUBKEYS_FAILED,

  ADD_TRUSTED_PUBKEY,

  VERIFY_INVITE_EMAIL_REQUEST,
  VERIFY_INVITE_EMAIL_API_SUCCESS
} from 'actions'

export const

  isDecryptingAll = (state = false, action)=>{
    switch(action.type){
      case DECRYPT_ALL:
      case VERIFY_CURRENT_USER_PUBKEY:
        return true

      case DECRYPT_ALL_SUCCESS:
      case DECRYPT_ENVS_FAILED:
      case LOGOUT:
      case SELECT_ORG:
      case LOGIN:
      case REGISTER:
        return false

      default:
        return state
    }
  },

  decryptedAll = (state = false, action)=>{
    switch(action.type){
      case DECRYPT_ALL:
      case LOGOUT:
      case SELECT_ORG:
      case LOGIN:
      case LOGIN_REQUEST:
      case REGISTER:
        return false

      case DECRYPT_ALL_SUCCESS:
        return true

      default:
        return state
    }
  },

  envsAreDecrypting = (state = {}, action)=>{
    switch(action.type){
      case DECRYPT_ENVS:
        return R.assoc(action.meta.targetId, true, state)

      case DECRYPT_ENVS_SUCCESS:
      case DECRYPT_ENVS_FAILED:
        return R.dissoc(action.meta.targetId, state)

      case LOGOUT:
      case SELECT_ORG:
      case LOGIN:
      case LOGIN_REQUEST:
      case REGISTER:
        return {}

      default:
        return state
    }
  },

  envsAreDecrypted = (state = {}, action)=>{
    switch(action.type){
      case DECRYPT_ENVS_SUCCESS:
        return R.assoc(action.meta.targetId, true, state)

      case LOGOUT:
      case SELECT_ORG:
      case LOGIN:
      case LOGIN_REQUEST:
      case REGISTER:
        return {}

      default:
        return state
    }
  },

  encryptedPrivkey = (state = null, action)=>{
    switch(action.type){
      case LOGIN_SUCCESS:
      case FETCH_CURRENT_USER_SUCCESS:
      case REGISTER_SUCCESS:
      case VERIFY_INVITE_EMAIL_API_SUCCESS:
        return action.payload.encryptedPrivkey
      case LOGIN:
      case LOGIN_REQUEST:
      case LOGOUT:
      case REGISTER:
      case DECRYPT_PRIVKEY_SUCCESS:
        return null
      default:
        return state
    }
  },

  privkey = (state = null, action)=>{
    switch(action.type){
      case DECRYPT_PRIVKEY_SUCCESS:
        return action.payload
      case LOGIN:
      case LOGIN_REQUEST:
      case LOGOUT:
      case REGISTER:
      case DECRYPT_ENVS_FAILED:
        return null
      default:
        return state
    }
  },

  isDecryptingPrivkey = (state = false, action)=>{
    switch(action.type){
      case DECRYPT_PRIVKEY:
        return true
      case DECRYPT_PRIVKEY_SUCCESS:
      case DECRYPT_PRIVKEY_FAILED:
      case LOGOUT:
      case SELECT_ORG:
      case LOGIN:
      case REGISTER:
        return false
      default:
        return state
    }
  },

  isGeneratingUserKey = (state = false, action)=>{
    switch(action.type){
      case GENERATE_USER_KEYPAIR:
        return true
      case GENERATE_USER_KEYPAIR_SUCCESS:
        return false
      default:
        return state
    }
  },

  signedTrustedPubkeys = ( state = null, action)=>{
    switch(action.type){
      case LOGIN_SUCCESS:
      case FETCH_CURRENT_USER_SUCCESS:
      case VERIFY_INVITE_EMAIL_API_SUCCESS:
        return action.payload.signedTrustedPubkeys || null

      case LOGIN:
      case LOGIN_REQUEST:
      case LOGOUT:
      case REGISTER:
      case VERIFY_TRUSTED_PUBKEYS_FAILED:
      case VERIFY_TRUSTED_PUBKEYS_SUCCESS:
        return null

      default:
        return state
    }
  },

  trustedPubkeys = ( state = {}, action)=>{
    switch(action.type){
      case VERIFY_TRUSTED_PUBKEYS_SUCCESS:
        return action.payload

      case ADD_TRUSTED_PUBKEY:
        return R.assoc(action.meta.keyableId, action.payload, state)

      case LOGIN:
      case LOGIN_REQUEST:
      case LOGOUT:
      case REGISTER:
      case VERIFY_TRUSTED_PUBKEYS_FAILED:
        return {}

      default:
        return state
    }
  },

  generatedEnvkeys = ( state = {}, action)=>{
    switch(action.type){
      case GENERATE_ASSOC_KEY_SUCCESS:
        return R.assoc(action.meta.targetId, {envkey: action.payload.envkey, passphrase: action.meta.passphrase}, state)

      case CLEAR_GENERATED_ASSOC_KEY:
        return R.dissoc(action.payload, state)

      case LOGIN:
      case LOGIN_REQUEST:
      case LOGOUT:
      case REGISTER:
        return {}

      default:
        return state
    }
  }

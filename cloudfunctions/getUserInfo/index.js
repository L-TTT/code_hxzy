const cloud = require('wx-server-sdk')

cloud.init({
  env: 'toust-d9gu1e0km340d2d2f'
})

exports.main = async (event, context) => {
  const wxContext = cloud.getWXContext()

  return {
    openid: wxContext.OPENID,
    appid: wxContext.APPID,
    unionid: wxContext.UNIONID,
  }
}
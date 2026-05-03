const cloud = require('wx-server-sdk')

cloud.init({
  env: 'toust-d9gu1e0km340d2d2f',
  traceUser: true,
})

const db = cloud.database()
const _ = db.command

exports.main = async (event, context) => {
  const { OPENID } = cloud.getWXContext()
  const { action } = event

  try {
    switch (action) {
      case 'createInvite':
        return await createInvite(OPENID)
      case 'acceptInvite':
        return await acceptInvite(OPENID, event.inviteCode)
      case 'getStatus':
        return await getStatus(OPENID)
      case 'updateCoupleInfo':
        return await updateCoupleInfo(OPENID, event.data)
      case 'addBucketItem':
        return await addBucketItem(OPENID, event.data)
      case 'listBucketItems':
        return await listBucketItems(OPENID, event.filter)
      case 'updateBucketItem':
        return await updateBucketItem(OPENID, event.itemId, event.data)
      case 'deleteBucketItem':
        return await deleteBucketItem(OPENID, event.itemId)
      case 'completeBucketItem':
        return await completeBucketItem(OPENID, event.itemId)
      case 'seedDefaultItems':
        return await seedDefaultItems(OPENID)
      default:
        return { code: -1, message: '无效的操作类型' }
    }
  } catch (err) {
    console.error('coupleManager error:', err)
    return { code: -1, message: err.message }
  }
}

function generateInviteCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  let code = ''
  for (let i = 0; i < 6; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length))
  }
  return code
}

async function createInvite(openid) {
  const userRes = await db.collection('users').where({ openid }).get()
  if (userRes.data.length === 0) {
    return { code: -1, message: '用户未注册' }
  }
  const user = userRes.data[0]

  if (user.coupleId) {
    const coupleRes = await db.collection('couples').doc(user.coupleId).get()
    if (coupleRes.data && coupleRes.data.status === 'active') {
      return { code: -1, message: '你已有情侣空间，无法重复创建' }
    }
  }

  const pendingRes = await db.collection('couples').where({
    partner1_openid: openid,
    status: 'pending',
    createdAt: _.gte(new Date(Date.now() - 24 * 60 * 60 * 1000)),
  }).get()

  if (pendingRes.data.length > 0) {
    return {
      code: 0,
      message: '已有有效邀请码',
      data: {
        inviteCode: pendingRes.data[0].inviteCode,
        coupleId: pendingRes.data[0]._id,
      },
    }
  }

  const inviteCode = generateInviteCode()
  const now = db.serverDate()
  const result = await db.collection('couples').add({
    data: {
      partner1_openid: openid,
      partner2_openid: '',
      partner1_name: user.nickName || '',
      partner2_name: '',
      startDate: '',
      inviteCode,
      status: 'pending',
      createdAt: now,
      updatedAt: now,
    },
  })

  return {
    code: 0,
    message: '邀请码已生成',
    data: {
      inviteCode,
      coupleId: result._id,
    },
  }
}

async function acceptInvite(openid, inviteCode) {
  if (!inviteCode || inviteCode.length !== 6) {
    return { code: -1, message: '邀请码格式错误' }
  }

  const userRes = await db.collection('users').where({ openid }).get()
  if (userRes.data.length === 0) {
    return { code: -1, message: '用户未注册' }
  }
  const user = userRes.data[0]

  if (user.coupleId) {
    const coupleRes = await db.collection('couples').doc(user.coupleId).get()
    if (coupleRes.data && coupleRes.data.status === 'active') {
      return { code: -1, message: '你已在情侣空间中' }
    }
  }

  const coupleRes = await db.collection('couples').where({
    inviteCode: inviteCode.toUpperCase(),
    status: 'pending',
    createdAt: _.gte(new Date(Date.now() - 24 * 60 * 60 * 1000)),
  }).get()

  if (coupleRes.data.length === 0) {
    return { code: -1, message: '邀请码无效或已过期' }
  }

  const couple = coupleRes.data[0]

  if (couple.partner1_openid === openid) {
    return { code: -1, message: '不能接受自己的邀请' }
  }

  const coupleId = couple._id
  const now = db.serverDate()

  await db.collection('couples').doc(coupleId).update({
    data: {
      partner2_openid: openid,
      partner2_name: user.nickName || '',
      status: 'active',
      updatedAt: now,
    },
  })

  await db.collection('users').where({ openid: couple.partner1_openid }).update({
    data: { coupleId },
  })
  await db.collection('users').where({ openid }).update({
    data: { coupleId },
  })

  migrateEvents(couple.partner1_openid, coupleId)
  migrateEvents(openid, coupleId)

  return {
    code: 0,
    message: '配对成功',
    data: { coupleId },
  }
}

async function migrateEvents(openid, coupleId) {
  try {
    const eventsRes = await db.collection('events').where({
      openid,
      coupleId: _.exists(false),
    }).get()

    for (const evt of eventsRes.data) {
      await db.collection('events').doc(evt._id).update({
        data: {
          coupleId,
          createdBy: openid,
          openid: _.remove(),
        },
      })
    }
  } catch (err) {
    console.error('migrateEvents error:', err)
  }
}

async function getStatus(openid) {
  const userRes = await db.collection('users').where({ openid }).get()
  if (userRes.data.length === 0) {
    return { code: 0, data: { paired: false } }
  }

  const user = userRes.data[0]
  if (!user.coupleId) {
    return { code: 0, data: { paired: false } }
  }

  try {
    const coupleRes = await db.collection('couples').doc(user.coupleId).get()
    if (!coupleRes.data || coupleRes.data.status !== 'active') {
      return { code: 0, data: { paired: false } }
    }

    const couple = coupleRes.data
    return {
      code: 0,
      data: {
        paired: true,
        coupleId: couple._id,
        partner1: {
          openid: couple.partner1_openid,
          name: couple.partner1_name,
        },
        partner2: {
          openid: couple.partner2_openid,
          name: couple.partner2_name,
        },
        startDate: couple.startDate,
        isPartner1: couple.partner1_openid === openid,
      },
    }
  } catch (err) {
    return { code: 0, data: { paired: false } }
  }
}

async function updateCoupleInfo(openid, data) {
  const userRes = await db.collection('users').where({ openid }).get()
  if (userRes.data.length === 0) {
    return { code: -1, message: '用户未注册' }
  }

  const user = userRes.data[0]
  if (!user.coupleId) {
    return { code: -1, message: '未配对' }
  }

  const updateData = { updatedAt: db.serverDate() }
  if (data.partner1_name !== undefined) updateData.partner1_name = data.partner1_name
  if (data.partner2_name !== undefined) updateData.partner2_name = data.partner2_name
  if (data.startDate !== undefined) updateData.startDate = data.startDate

  await db.collection('couples').doc(user.coupleId).update({ data: updateData })
  return { code: 0, message: '更新成功' }
}

async function getCoupleId(openid) {
  const userRes = await db.collection('users').where({ openid }).get()
  if (userRes.data.length === 0) return null
  return userRes.data[0].coupleId || null
}

async function addBucketItem(openid, data) {
  const coupleId = await getCoupleId(openid)
  if (!coupleId) return { code: -1, message: '未配对' }

  if (!data.title || !data.title.trim()) {
    return { code: -1, message: '请输入心愿内容' }
  }

  const now = db.serverDate()
  const result = await db.collection('bucket_list').add({
    data: {
      coupleId,
      title: data.title.trim(),
      description: (data.description || '').trim(),
      category: data.category || '日常',
      status: 'pending',
      createdBy: openid,
      createdAt: now,
      updatedAt: now,
      completedAt: null,
      completedBy: '',
      linkedEventId: '',
    },
  })

  return { code: 0, message: '添加成功', data: { _id: result._id } }
}

async function listBucketItems(openid, filter) {
  const coupleId = await getCoupleId(openid)
  if (!coupleId) return { code: 0, data: [] }

  const query = { coupleId }

  if (filter) {
    if (filter.status && filter.status !== 'all') {
      query.status = filter.status
    }
    if (filter.category && filter.category !== 'all') {
      query.category = filter.category
    }
  }

  let orderField = 'createdAt'
  let orderDir = 'desc'
  if (filter) {
    if (filter.sortBy === 'category') {
      orderField = 'category'
      orderDir = 'asc'
    } else if (filter.sortBy === 'status') {
      orderField = 'status'
      orderDir = 'asc'
    }
  }

  const countRes = await db.collection('bucket_list').where(query).count()
  const total = countRes.total
  const batchSize = 20
  const tasks = []

  for (let i = 0; i < total; i += batchSize) {
    tasks.push(
      db.collection('bucket_list')
        .where(query)
        .orderBy(orderField, orderDir)
        .orderBy('createdAt', 'desc')
        .skip(i)
        .limit(batchSize)
        .get()
    )
  }

  const results = await Promise.all(tasks)
  const items = results.reduce((acc, cur) => acc.concat(cur.data), [])

  return { code: 0, data: items }
}

async function updateBucketItem(openid, itemId, data) {
  if (!itemId) return { code: -1, message: '缺少参数' }

  const coupleId = await getCoupleId(openid)
  if (!coupleId) return { code: -1, message: '未配对' }

  const itemRes = await db.collection('bucket_list').doc(itemId).get()
  if (!itemRes.data || itemRes.data.coupleId !== coupleId) {
    return { code: -1, message: '无权操作' }
  }

  const updateData = { updatedAt: db.serverDate() }
  if (data.title !== undefined) updateData.title = data.title.trim()
  if (data.description !== undefined) updateData.description = data.description.trim()
  if (data.category !== undefined) updateData.category = data.category

  await db.collection('bucket_list').doc(itemId).update({ data: updateData })
  return { code: 0, message: '更新成功' }
}

async function deleteBucketItem(openid, itemId) {
  if (!itemId) return { code: -1, message: '缺少参数' }

  const coupleId = await getCoupleId(openid)
  if (!coupleId) return { code: -1, message: '未配对' }

  const itemRes = await db.collection('bucket_list').doc(itemId).get()
  if (!itemRes.data || itemRes.data.coupleId !== coupleId) {
    return { code: -1, message: '无权操作' }
  }

  await db.collection('bucket_list').doc(itemId).remove()
  return { code: 0, message: '删除成功' }
}

async function completeBucketItem(openid, itemId) {
  if (!itemId) return { code: -1, message: '缺少参数' }

  const coupleId = await getCoupleId(openid)
  if (!coupleId) return { code: -1, message: '未配对' }

  const itemRes = await db.collection('bucket_list').doc(itemId).get()
  if (!itemRes.data || itemRes.data.coupleId !== coupleId) {
    return { code: -1, message: '无权操作' }
  }

  const item = itemRes.data
  const newStatus = item.status === 'done' ? 'pending' : 'done'
  const updateData = {
    status: newStatus,
    updatedAt: db.serverDate(),
  }

  if (newStatus === 'done') {
    updateData.completedAt = db.serverDate()
    updateData.completedBy = openid
  } else {
    updateData.completedAt = null
    updateData.completedBy = ''
    updateData.linkedEventId = ''
  }

  await db.collection('bucket_list').doc(itemId).update({ data: updateData })
  return { code: 0, message: newStatus === 'done' ? '已完成' : '已恢复', data: { status: newStatus } }
}

const DEFAULT_WISHES = [
  { title: '一起看日出', category: '旅行' },
  { title: '去海边散步', category: '旅行' },
  { title: '一起露营看星空', category: '旅行' },
  { title: '去迪士尼乐园', category: '旅行' },
  { title: '一起自驾游', category: '旅行' },
  { title: '去古镇住一晚', category: '旅行' },
  { title: '一起坐热气球', category: '旅行' },
  { title: '去看极光', category: '旅行' },
  { title: '一起骑行环湖', category: '旅行' },
  { title: '去稻城亚丁', category: '旅行' },
  { title: '一起泡温泉', category: '旅行' },
  { title: '去看一场雪', category: '旅行' },
  { title: '一起坐邮轮', category: '旅行' },
  { title: '去云南大理', category: '旅行' },
  { title: '一起爬一次泰山', category: '旅行' },
  { title: '去看薰衣草花田', category: '旅行' },
  { title: '一起去看樱花', category: '旅行' },
  { title: '去西藏旅行', category: '旅行' },
  { title: '一起打卡网红餐厅', category: '美食' },
  { title: '一起做一顿饭', category: '美食' },
  { title: '一起吃火锅', category: '美食' },
  { title: '一起烘焙蛋糕', category: '美食' },
  { title: '一起喝下午茶', category: '美食' },
  { title: '一起吃小龙虾', category: '美食' },
  { title: '一起做寿司', category: '美食' },
  { title: '一起吃烧烤', category: '美食' },
  { title: '一起包饺子', category: '美食' },
  { title: '一起喝一次精酿啤酒', category: '美食' },
  { title: '一起吃遍一条小吃街', category: '美食' },
  { title: '一起做一顿早餐', category: '美食' },
  { title: '一起学做一道新菜', category: '美食' },
  { title: '一起吃一次米其林', category: '美食' },
  { title: '一起做奶茶', category: '美食' },
  { title: '一起吃烤肉', category: '美食' },
  { title: '一起吃甜品自助', category: '美食' },
  { title: '一起包汤圆', category: '美食' },
  { title: '一起吃一次野餐', category: '美食' },
  { title: '一起看一场电影', category: '体验' },
  { title: '一起看演唱会', category: '体验' },
  { title: '一起拍一套情侣照', category: '体验' },
  { title: '一起画画', category: '体验' },
  { title: '一起做陶艺', category: '体验' },
  { title: '一起唱K', category: '体验' },
  { title: '一起看话剧', category: '体验' },
  { title: '一起学一支舞蹈', category: '体验' },
  { title: '一起做手工', category: '体验' },
  { title: '一起看日落', category: '体验' },
  { title: '一起放烟花', category: '体验' },
  { title: '一起打一次保龄球', category: '体验' },
  { title: '一起打电玩', category: '体验' },
  { title: '一起学一门乐器', category: '体验' },
  { title: '一起去看海豚表演', category: '体验' },
  { title: '一起做义工', category: '体验' },
  { title: '一起去游乐场', category: '体验' },
  { title: '一起看一次流星雨', category: '体验' },
  { title: '一起去做一次SPA', category: '体验' },
  { title: '一起种一棵树', category: '体验' },
  { title: '一起养一只宠物', category: '日常' },
  { title: '一起养一盆花', category: '日常' },
  { title: '一起打扫房间', category: '日常' },
  { title: '一起敷面膜', category: '日常' },
  { title: '一起看一部电视剧', category: '日常' },
  { title: '一起读一本书', category: '日常' },
  { title: '一起晨跑', category: '日常' },
  { title: '一起逛超市', category: '日常' },
  { title: '一起午睡', category: '日常' },
  { title: '一起打游戏到凌晨', category: '日常' },
  { title: '一起做一次大扫除', category: '日常' },
  { title: '一起买情侣装', category: '日常' },
  { title: '一起逛宜家', category: '日常' },
  { title: '一起种多肉', category: '日常' },
  { title: '一起看星星', category: '日常' },
  { title: '一起写一封情书', category: '日常' },
  { title: '一起泡脚看电影', category: '日常' },
  { title: '一起互相画一幅画', category: '日常' },
  { title: '一起给对方做早餐', category: '日常' },
  { title: '一起录一段视频', category: '日常' },
  { title: '一起跑一次马拉松', category: '挑战' },
  { title: '一起学游泳', category: '挑战' },
  { title: '一起蹦极', category: '挑战' },
  { title: '一起跳伞', category: '挑战' },
  { title: '一起攀岩', category: '挑战' },
  { title: '一起骑行100公里', category: '挑战' },
  { title: '一起坚持健身一个月', category: '挑战' },
  { title: '一起学一门外语', category: '挑战' },
  { title: '一起坚持早起一个月', category: '挑战' },
  { title: '一起连续21天互相说情话', category: '挑战' },
  { title: '一起挑战一天不看手机', category: '挑战' },
  { title: '一起挑战做100个俯卧撑', category: '挑战' },
  { title: '一起学冲浪', category: '挑战' },
  { title: '一起完成一次徒步穿越', category: '挑战' },
  { title: '一起坚持冥想一周', category: '挑战' },
  { title: '一起学潜水', category: '挑战' },
  { title: '一起完成一次半马', category: '挑战' },
  { title: '一起挑战攀冰', category: '挑战' },
  { title: '一起学会一道甜点', category: '挑战' },
  { title: '一起完成一次自驾穿越', category: '挑战' },
]

async function seedDefaultItems(openid) {
  console.log('[seedDefaultItems] called by openid:', openid)
  const coupleId = await getCoupleId(openid)
  console.log('[seedDefaultItems] coupleId:', coupleId)
  if (!coupleId) return { code: -1, message: '未配对' }

  const existing = await db.collection('bucket_list').where({ coupleId }).count()
  console.log('[seedDefaultItems] existing count:', existing.total)
  if (existing.total > 0) {
    return { code: 0, message: '已有心愿数据', data: { seeded: false } }
  }

  const now = db.serverDate()
  const batchSize = 20
  let insertedCount = 0
  for (let i = 0; i < DEFAULT_WISHES.length; i += batchSize) {
    const batch = DEFAULT_WISHES.slice(i, i + batchSize)
    const tasks = batch.map(wish =>
      db.collection('bucket_list').add({
        data: {
          coupleId,
          title: wish.title,
          description: '',
          category: wish.category,
          status: 'pending',
          createdBy: openid,
          createdAt: now,
          updatedAt: now,
          completedAt: null,
          completedBy: '',
          linkedEventId: '',
        },
      })
    )
    await Promise.all(tasks)
    insertedCount += batch.length
    console.log('[seedDefaultItems] batch', Math.floor(i / batchSize) + 1, 'inserted:', batch.length)
  }

  console.log('[seedDefaultItems] total inserted:', insertedCount)
  return { code: 0, message: '初始化成功', data: { seeded: true, count: insertedCount } }
}

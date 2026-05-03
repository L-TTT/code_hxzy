const cloud = require('wx-server-sdk')

cloud.init({
  env: 'toust-d9gu1e0km340d2d2f',
  traceUser: true,
})

const db = cloud.database()
const _ = db.command

exports.main = async (event, context) => {
  const { OPENID } = cloud.getWXContext()
  const { action, eventData, eventId, filter } = event

  try {
    switch (action) {
      case 'create':
        return await createEvent(OPENID, eventData)
      case 'update':
        return await updateEvent(OPENID, eventId, eventData)
      case 'delete':
        return await deleteEvent(OPENID, eventId)
      case 'get':
        return await getEvent(OPENID, eventId)
      case 'list':
        return await listEvents(OPENID, filter)
      case 'batchCreate':
        return await batchCreateEvents(OPENID, eventData.events)
      case 'getPartnerActivity':
        return await getPartnerActivity(OPENID, event.since)
      default:
        return { code: -1, message: '无效的操作类型' }
    }
  } catch (err) {
    console.error('eventManager error:', err)
    return { code: -1, message: err.message }
  }
}

async function getCoupleId(openid) {
  try {
    const userRes = await db.collection('users').where({ openid }).get()
    if (userRes.data.length > 0 && userRes.data[0].coupleId) {
      return userRes.data[0].coupleId
    }
  } catch (err) {
    console.error('getCoupleId error:', err)
  }
  return null
}

async function hasCoupleAccess(openid, coupleId) {
  if (!coupleId) return false
  try {
    const coupleRes = await db.collection('couples').doc(coupleId).get()
    if (!coupleRes.data || coupleRes.data.status !== 'active') return false
    return coupleRes.data.partner1_openid === openid || coupleRes.data.partner2_openid === openid
  } catch (err) {
    return false
  }
}

async function createEvent(openid, data) {
  if (!data.title || !data.title.trim()) {
    return { code: -1, message: '标题不能为空' }
  }
  if (!data.date) {
    return { code: -1, message: '日期不能为空' }
  }

  const coupleId = await getCoupleId(openid)
  const now = db.serverDate()

  const record = {
    title: data.title.trim(),
    date: data.date,
    description: (data.description || '').trim(),
    type: data.type || 'daily',
    photos: data.photos || [],
    music: data.music || null,
    location: data.location || null,
    sort: data.sort || 0,
    createdAt: now,
    updatedAt: now,
  }

  if (coupleId) {
    record.coupleId = coupleId
    record.createdBy = openid
    record.lastUpdatedBy = openid
  } else {
    record.openid = openid
  }

  const result = await db.collection('events').add({ data: record })

  if (coupleId) {
    try {
      await db.collection('activity_log').add({
        data: {
          coupleId,
          operatorOpenid: openid,
          action: 'create',
          eventId: result._id,
          eventTitle: data.title.trim(),
          createdAt: now,
        },
      })
    } catch (_e) { void 0 }
  }

  return { code: 0, message: '创建成功', data: { _id: result._id } }
}

async function updateEvent(openid, eventId, data) {
  const existing = await db.collection('events').doc(eventId).get()
  if (!existing.data) {
    return { code: -1, message: '事件不存在' }
  }

  const evt = existing.data
  let hasAccess = false

  if (evt.coupleId) {
    hasAccess = await hasCoupleAccess(openid, evt.coupleId)
  } else {
    hasAccess = evt.openid === openid
  }

  if (!hasAccess) {
    return { code: -1, message: '无权限操作' }
  }

  const updateData = { updatedAt: db.serverDate(), lastUpdatedBy: openid }
  if (data.title !== undefined) updateData.title = data.title.trim()
  if (data.date !== undefined) updateData.date = data.date
  if (data.description !== undefined) updateData.description = data.description.trim()
  if (data.type !== undefined) updateData.type = data.type
  if (data.photos !== undefined) updateData.photos = data.photos
  if (data.music !== undefined) updateData.music = data.music
  if (data.location !== undefined) updateData.location = data.location
  if (data.sort !== undefined) updateData.sort = data.sort

  await db.collection('events').doc(eventId).update({ data: updateData })

  if (evt.coupleId) {
    try {
      await db.collection('activity_log').add({
        data: {
          coupleId: evt.coupleId,
          operatorOpenid: openid,
          action: 'update',
          eventId,
          eventTitle: data.title !== undefined ? data.title.trim() : evt.title,
          createdAt: db.serverDate(),
        },
      })
    } catch (_e) { void 0 }
  }

  return { code: 0, message: '更新成功' }
}

async function deleteEvent(openid, eventId) {
  const existing = await db.collection('events').doc(eventId).get()
  if (!existing.data) {
    return { code: -1, message: '事件不存在' }
  }

  const evt = existing.data
  let hasAccess = false

  if (evt.coupleId) {
    hasAccess = await hasCoupleAccess(openid, evt.coupleId)
  } else {
    hasAccess = evt.openid === openid
  }

  if (!hasAccess) {
    return { code: -1, message: '无权限操作' }
  }

  await db.collection('events').doc(eventId).remove()

  if (evt.coupleId) {
    try {
      await db.collection('activity_log').add({
        data: {
          coupleId: evt.coupleId,
          operatorOpenid: openid,
          action: 'delete',
          eventId,
          eventTitle: evt.title,
          createdAt: db.serverDate(),
        },
      })
    } catch (_e) { void 0 }
  }

  return { code: 0, message: '删除成功' }
}

async function getEvent(openid, eventId) {
  const existing = await db.collection('events').doc(eventId).get()
  if (!existing.data) {
    return { code: -1, message: '事件不存在' }
  }

  const evt = existing.data
  let hasAccess = false

  if (evt.coupleId) {
    hasAccess = await hasCoupleAccess(openid, evt.coupleId)
  } else {
    hasAccess = evt.openid === openid
  }

  if (!hasAccess) {
    return { code: -1, message: '事件不存在或无权限' }
  }

  return { code: 0, data: existing.data }
}

async function listEvents(openid, filter = {}) {
  const coupleId = await getCoupleId(openid)

  let query
  if (coupleId) {
    query = { coupleId }
  } else {
    query = { openid }
  }

  if (filter.type) {
    query.type = filter.type
  }

  let dateCondition = null
  if (filter.startDate) {
    dateCondition = _.gte(filter.startDate)
  }
  if (filter.endDate) {
    dateCondition = dateCondition
      ? _.and([dateCondition, _.lte(filter.endDate)])
      : _.lte(filter.endDate)
  }
  if (dateCondition) {
    query.date = dateCondition
  }

  const result = await db.collection('events')
    .where(query)
    .orderBy(filter.sortField || 'date', filter.sortOrder || 'asc')
    .skip(filter.skip || 0)
    .limit(filter.limit || 100)
    .get()

  return { code: 0, data: result.data }
}

async function batchCreateEvents(openid, events) {
  const results = await Promise.all(events.map(e => createEvent(openid, e)))
  const successCount = results.filter(r => r.code === 0).length
  return { code: 0, message: `成功创建 ${successCount}/${events.length} 个事件`, data: results }
}

async function getPartnerActivity(openid, since) {
  const coupleId = await getCoupleId(openid)
  if (!coupleId) {
    return { code: 0, data: [] }
  }

  const query = {
    coupleId,
    operatorOpenid: _.neq(openid),
  }

  if (since) {
    query.createdAt = _.gte(new Date(since))
  }

  try {
    const result = await db.collection('activity_log')
      .where(query)
      .orderBy('createdAt', 'desc')
      .limit(20)
      .get()

    return { code: 0, data: result.data }
  } catch (_err) {
    return { code: 0, data: [] }
  }
}

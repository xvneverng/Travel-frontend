<template>
  <div class="page">
    <header class="header">
      <div class="header-back">〈</div>
      <div class="header-title">我的行程</div>
    </header>

    <section class="banner">
      <img class="banner-img" src="https://img.alicdn.com/imgextra/i4/O1CN01uQJ5x91aV4VsgIanb_!!6000000003332-0-tps-1125-630.jpg" alt="封面" />
      <div class="banner-mask"></div>
      <div class="banner-content">
        <div class="banner-name">{{ travelInfo.guideName || '行程名称加载中' }}</div>
        <div class="banner-dest">{{ travelInfo.destination || '目的地' }}</div>
      </div>
    </section>

    <nav class="tabs">
      <button class="tab active">行程总览</button>
      <button class="tab" @click="$emit('go-day1')">DAY1 路书</button>
    </nav>

    <main class="content">
      <section class="card">
        <div class="card-title">行程信息</div>
        <div class="trip-row">
          <span>出行日期</span>
          <span>{{ dateRangeText }}</span>
        </div>
        <div class="trip-row">
          <span>行程天数</span>
          <span>{{ travelInfo.durationDesc || (travelInfo.durationDays ? travelInfo.durationDays + '天' : '-') }}</span>
        </div>
        <p class="trip-desc">{{ travelInfo.description || '行程描述加载中...' }}</p>
      </section>

      <section class="card">
        <div class="card-title">准备事项</div>
        <div v-if="loadingPrep" class="loading">准备事项加载中...</div>
        <div v-else>
          <div v-for="(category, name) in preparationItems" :key="name" class="prep-group">
            <div class="prep-header">
              <span>{{ name }}</span>
              <span class="prep-progress">{{ category.completed }}/{{ category.total }} · {{ category.percentage }}%</span>
            </div>
            <ul class="prep-list">
              <li v-for="item in category.items" :key="item.name" class="prep-item">
                <span class="prep-check" :class="{ done: item.completed }">✔</span>
                <span :class="{ 'prep-done-text': item.completed }">{{ item.name }}</span>
              </li>
            </ul>
          </div>
        </div>
      </section>

      <section class="card">
        <div class="card-title">我的注意事项</div>
        <textarea
          class="notes-textarea"
          v-model="myNotesLocal"
          placeholder="写下本次旅行需要特别注意的事项..."
          @blur="saveMyNotes"
        ></textarea>
        <div class="notes-tip">失去焦点自动保存到后端</div>
      </section>
    </main>
  </div>
</template>

<script setup>
import { onMounted, reactive, ref, computed } from 'https://unpkg.com/vue@3.3.4/dist/vue.esm-browser.prod.js';

const props = defineProps({
  apiBaseUrl: { type: String, required: true },
});

const travelInfo = reactive({
  guideName: '',
  destination: '',
  startDate: '',
  endDate: '',
  durationDays: 0,
  durationDesc: '',
  description: '',
  myNotes: '',
});

const preparationItems = reactive({});
const loadingPrep = ref(true);
const myNotesLocal = ref('');

const dateRangeText = computed(() => {
  if (!travelInfo.startDate || !travelInfo.endDate) return '-';
  return `${travelInfo.startDate} 至 ${travelInfo.endDate}`;
});

async function fetchJson(url, options = {}) {
  const res = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'no-cache',
      Pragma: 'no-cache',
      ...(options.headers || {}),
    },
  });
  return res.json();
}

async function loadTravelInfo() {
  try {
    const data = await fetchJson(`${props.apiBaseUrl}/api/travel/guide/travel-info`);
    if (data && data.code === 200 && data.data) {
      Object.assign(travelInfo, data.data);
      myNotesLocal.value = data.data.myNotes || '';
    }
  } catch (e) {
    console.error('加载行程信息失败', e);
  }
}

async function loadPreparationItems() {
  loadingPrep.value = true;
  try {
    const data = await fetchJson(`${props.apiBaseUrl}/api/travel/guide/preparation-items`);
    if (data && data.code === 200 && data.data) {
      Object.assign(preparationItems, data.data);
    }
  } catch (e) {
    console.error('加载准备事项失败', e);
  } finally {
    loadingPrep.value = false;
  }
}

async function loadMyNotes() {
  try {
    const data = await fetchJson(`${props.apiBaseUrl}/api/travel/guide/my-notes`);
    if (data && data.code === 200) {
      myNotesLocal.value = data.data || '';
    }
  } catch (e) {
    console.error('加载我的注意事项失败', e);
  }
}

let saving = false;
async function saveMyNotes() {
  if (saving) return;
  saving = true;
  try {
    await fetchJson(`${props.apiBaseUrl}/api/travel/guide/my-notes/update`, {
      method: 'POST',
      body: JSON.stringify({ userId: 'default_user', myNotes: myNotesLocal.value || '' }),
    });
  } catch (e) {
    console.error('保存我的注意事项失败', e);
  } finally {
    saving = false;
  }
}

onMounted(() => {
  loadTravelInfo();
  loadPreparationItems();
  loadMyNotes();
});
</script>

<style scoped>
.page {
  background: #f5f6fa;
  min-height: 100vh;
}
.header {
  height: 44px;
  display: flex;
  align-items: center;
  padding: 0 12px;
  background: #ffffff;
  border-bottom: 1px solid #eee;
}
.header-back {
  width: 32px;
  font-size: 20px;
}
.header-title {
  flex: 1;
  text-align: center;
  font-weight: 600;
}
.banner {
  position: relative;
  height: 180px;
  overflow: hidden;
}
.banner-img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}
.banner-mask {
  position: absolute;
  inset: 0;
  background: linear-gradient(to top, rgba(0, 0, 0, 0.6), transparent);
}
.banner-content {
  position: absolute;
  left: 16px;
  bottom: 16px;
  color: #fff;
}
.banner-name {
  font-size: 18px;
  font-weight: 600;
}
.banner-dest {
  font-size: 13px;
  opacity: 0.9;
}
.tabs {
  display: flex;
  background: #ffffff;
  border-bottom: 1px solid #eee;
}
.tab {
  flex: 1;
  padding: 10px 0;
  border: none;
  background: transparent;
  font-size: 14px;
}
.tab.active {
  color: #1677ff;
  border-bottom: 2px solid #1677ff;
}
.content {
  padding: 12px;
}
.card {
  background: #ffffff;
  border-radius: 10px;
  padding: 12px 14px;
  margin-bottom: 12px;
}
.card-title {
  font-size: 15px;
  font-weight: 600;
  margin-bottom: 8px;
}
.trip-row {
  display: flex;
  justify-content: space-between;
  font-size: 13px;
  margin-bottom: 4px;
}
.trip-desc {
  margin-top: 8px;
  font-size: 13px;
  color: #555;
}
.prep-group {
  margin-top: 6px;
}
.prep-header {
  display: flex;
  justify-content: space-between;
  font-size: 13px;
  margin-bottom: 4px;
}
.prep-progress {
  color: #999;
}
.prep-list {
  list-style: none;
  padding: 0;
  margin: 0;
}
.prep-item {
  display: flex;
  align-items: center;
  font-size: 13px;
  padding: 2px 0;
}
.prep-check {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 16px;
  height: 16px;
  border-radius: 50%;
  border: 1px solid #ccc;
  font-size: 10px;
  margin-right: 6px;
  color: transparent;
}
.prep-check.done {
  background: #52c41a;
  border-color: #52c41a;
  color: #fff;
}
.prep-done-text {
  color: #999;
  text-decoration: line-through;
}
.notes-textarea {
  width: 100%;
  min-height: 80px;
  border-radius: 8px;
  border: 1px solid #e0e0e0;
  padding: 8px;
  font-size: 13px;
  box-sizing: border-box;
  resize: vertical;
}
.notes-tip {
  margin-top: 4px;
  font-size: 11px;
  color: #999;
}
.loading {
  font-size: 13px;
  color: #999;
}
</style>

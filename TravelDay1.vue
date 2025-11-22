<template>
  <div class="page">
    <header class="header">
      <div class="header-back" @click="$emit('go-overview')">〈</div>
      <div class="header-title">DAY1 路书</div>
    </header>

    <section class="banner">
      <img class="banner-img" src="https://img.alicdn.com/imgextra/i2/O1CN01qgV7Jc1Kf7i7cRW2Q_!!6000000001212-0-tps-1125-630.jpg" alt="封面" />
      <div class="banner-mask"></div>
      <div class="banner-content">
        <div class="banner-name">南京古都深度游 · DAY1</div>
        <div class="banner-dest">南京南站 → 中山陵 → 夫子庙 → 南京博物院</div>
      </div>
    </section>

    <main class="content">
      <section class="card">
        <div class="card-title-row">
          <div>
            <div class="card-title">今日概览</div>
            <div class="card-sub">{{ itinerary.travelDate || '日期加载中' }}</div>
          </div>
          <div class="weather" v-if="itinerary.weatherCondition">
            <div class="weather-main">{{ itinerary.weatherIcon }} {{ itinerary.weatherCondition }}</div>
            <div class="weather-temp" v-if="itinerary.temperatureMin !== null">{{ itinerary.temperatureMin }}~{{ itinerary.temperatureMax }}℃</div>
          </div>
        </div>
        <p class="trip-notes" v-if="itinerary.notes">今日提示：{{ itinerary.notes }}</p>
      </section>

      <section class="card">
        <div class="card-title">总体路线地图</div>
        <div class="map-container" v-if="mapUrl">
          <iframe :src="mapUrl" frameborder="0"></iframe>
        </div>
        <div v-else class="loading">地图加载中...</div>
      </section>

      <section class="card" v-for="(segment, idx) in segments" :key="idx">
        <div class="segment-header">
          <div class="segment-dot">{{ idx + 1 }}</div>
          <div>
            <div class="segment-title">{{ segment.from }} → {{ segment.to }}</div>
            <div class="segment-sub">交通：{{ segment.transportationInfo || '自动规划' }}</div>
          </div>
        </div>
        <div class="map-container small" v-if="segment.mapUrl">
          <iframe :src="segment.mapUrl" frameborder="0"></iframe>
        </div>
      </section>

      <section class="card">
        <div class="card-title-row">
          <div class="card-title">今日感受</div>
          <button class="edit-btn" @click="editing = true">编辑</button>
        </div>
        <p v-if="!editing" class="feelings-text">{{ feelings || '点击右上角编辑，记录今天的旅行感受...' }}</p>
        <div v-else>
          <textarea v-model="feelingsDraft" class="notes-textarea" rows="5"></textarea>
          <div class="btn-row">
            <button class="btn secondary" @click="cancelEdit">取消</button>
            <button class="btn primary" @click="saveFeelings">保存</button>
          </div>
        </div>
      </section>
    </main>
  </div>
</template>

<script setup>
import { onMounted, reactive, ref } from 'https://unpkg.com/vue@3.3.4/dist/vue.esm-browser.prod.js';

const props = defineProps({
  apiBaseUrl: { type: String, required: true },
});

const USER_ID = 'default_user';
const DAY_NUMBER = 1;

const itinerary = reactive({
  id: null,
  travelDate: '',
  dayNumber: DAY_NUMBER,
  weatherCondition: '',
  weatherIcon: '',
  temperatureMin: null,
  temperatureMax: null,
  notes: '',
  attractions: [],
});

const mapUrl = ref('');
const segments = ref([]);
const feelings = ref('');
const feelingsDraft = ref('');
const editing = ref(false);

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

async function loadItinerary() {
  try {
    const data = await fetchJson(`${props.apiBaseUrl}/api/travel/itinerary/user/${USER_ID}/day/${DAY_NUMBER}`);
    if (data && data.success && data.data) {
      Object.assign(itinerary, data.data);
      buildRouteMaps();
    }
  } catch (e) {
    console.error('加载行程失败', e);
  }
}

async function buildRouteMaps() {
  const names = itinerary.attractions && itinerary.attractions.length
    ? itinerary.attractions.map(a => a.name)
    : ['南京南站', '中山陵', '夫子庙', '南京博物院'];

  if (names.length < 2) return;

  await loadMainMap(names);
  await loadSegmentMaps(names);
}

async function loadMainMap(locations) {
  try {
    const body = { locations, strategy: 'driving' };
    const data = await fetchJson(`${props.apiBaseUrl}/api/route/map`, {
      method: 'POST',
      body: JSON.stringify(body),
    });
    if (data && data.code === 200 && data.data && data.data.mapUrl) {
      mapUrl.value = data.data.mapUrl;
    }
  } catch (e) {
    console.error('加载总地图失败', e);
  }
}

async function loadSegmentMaps(locations) {
  const result = [];
  for (let i = 0; i < locations.length - 1; i++) {
    const from = locations[i];
    const to = locations[i + 1];
    try {
      const body = { locations: [from, to], strategy: 'driving' };
      const data = await fetchJson(`${props.apiBaseUrl}/api/route/map`, {
        method: 'POST',
        body: JSON.stringify(body),
      });
      const map = data && data.code === 200 && data.data ? data.data.mapUrl : '';
      result.push({ from, to, transportationInfo: '', mapUrl: map });
      await new Promise(r => setTimeout(r, 400));
    } catch (e) {
      console.error('加载分段地图失败', from, to, e);
    }
  }
  segments.value = result;
}

async function loadFeelings() {
  try {
    const data = await fetchJson(`${props.apiBaseUrl}/api/travel/itinerary/feelings/${DAY_NUMBER}?userId=${USER_ID}`);
    if (data && data.code === 200) {
      feelings.value = data.data || '';
    } else {
      feelings.value = '';
    }
  } catch (e) {
    console.error('加载旅游感受失败', e);
  }
}

function cancelEdit() {
  editing.value = false;
  feelingsDraft.value = feelings.value;
}

async function saveFeelings() {
  try {
    const body = { userId: USER_ID, dayNumber: DAY_NUMBER, content: feelingsDraft.value || '' };
    const data = await fetchJson(`${props.apiBaseUrl}/api/travel/itinerary/feelings`, {
      method: 'POST',
      body: JSON.stringify(body),
    });
    if (data && data.code === 200) {
      feelings.value = feelingsDraft.value;
      editing.value = false;
    }
  } catch (e) {
    console.error('保存旅游感受失败', e);
  }
}

onMounted(async () => {
  await loadItinerary();
  await loadFeelings();
  feelingsDraft.value = feelings.value;
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
}
.card-title-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 6px;
}
.card-sub {
  font-size: 12px;
  color: #999;
}
.weather-main {
  font-size: 13px;
}
.weather-temp {
  font-size: 12px;
  color: #999;
}
.trip-notes {
  margin-top: 6px;
  font-size: 13px;
  color: #555;
}
.map-container {
  width: 100%;
  height: 220px;
  border-radius: 10px;
  overflow: hidden;
  background: #f0f0f0;
}
.map-container.small {
  height: 200px;
  margin-top: 8px;
}
.map-container iframe {
  width: 100%;
  height: 100%;
  border: none;
}
.segment-header {
  display: flex;
  align-items: center;
  gap: 8px;
}
.segment-dot {
  width: 22px;
  height: 22px;
  border-radius: 50%;
  background: #1677ff;
  color: #fff;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 12px;
}
.segment-title {
  font-size: 14px;
  font-weight: 500;
}
.segment-sub {
  font-size: 12px;
  color: #999;
}
.loading {
  font-size: 13px;
  color: #999;
}
.card-title-row .edit-btn {
  border: none;
  background: transparent;
  color: #1677ff;
  font-size: 13px;
}
.feelings-text {
  font-size: 13px;
  color: #555;
  white-space: pre-wrap;
}
.notes-textarea {
  width: 100%;
  border-radius: 8px;
  border: 1px solid #e0e0e0;
  padding: 8px;
  font-size: 13px;
  box-sizing: border-box;
}
.btn-row {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  margin-top: 8px;
}
.btn {
  border-radius: 6px;
  padding: 6px 12px;
  font-size: 13px;
  border: none;
}
.btn.primary {
  background: #1677ff;
  color: #fff;
}
.btn.secondary {
  background: #f5f5f5;
  color: #333;
}
</style>

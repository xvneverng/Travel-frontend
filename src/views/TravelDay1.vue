
<template>
  <div class="page">
    <header class="header">
      <div class="header-title">沿途路书</div>
    </header>

    <section class="banner">
      <div
        v-if="bannerPhotoUrl"
        class="banner-bg"
        :style="{ backgroundImage: 'url(' + bannerPhotoUrl + ')' }"
      ></div>
      <div class="banner-mask"></div>
      <div class="banner-content">
        <div class="banner-name">南京古都深度游 · DAY{{ props.dayNumber }}</div>
        <div class="banner-dest">南京南站 → 中山陵 → 夫子庙 → 南京博物院</div>
      </div>
    </section>

    <div class="day-nav-wrapper">
      <div class="day-nav">
        <button class="day-tab" @click="goOverview">总览</button>
        <button class="day-tab" :class="{ active: props.dayNumber === 1 }" @click="goDay(1)">DAY1</button>
        <button class="day-tab" :class="{ active: props.dayNumber === 2 }" @click="goDay(2)">DAY2</button>
        <button class="day-tab" :class="{ active: props.dayNumber === 3 }" @click="goDay(3)">DAY3</button>
      </div>
    </div>

    <main class="content">
      <section class="card">
        <div class="card-title-row">
          <div>
            <div class="card-title">今日概览</div>
            <div class="card-sub">{{ itinerary.travelDate || '日期加载中' }}</div>
          </div>
          <div class="weather" v-if="itinerary.weatherCondition">
            <div class="weather-main">{{ itinerary.weatherIcon }} {{ itinerary.weatherCondition }}</div>
            <div class="weather-temp" v-if="itinerary.temperatureMin !== null">
              {{ itinerary.temperatureMin }}~{{ itinerary.temperatureMax }}℃
            </div>
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

        <div v-if="segment.attraction" class="poi-card">
          <div
            class="poi-photo"
            v-if="segment.attraction.photoUrl"
          >
            <img :src="segment.attraction.photoUrl" :alt="segment.attraction.name" />
          </div>
          <div class="poi-info">
            <div class="poi-title-row">
              <div class="poi-name">{{ segment.attraction.name }}</div>
              <div class="poi-duration" v-if="segment.attraction.duration">{{ segment.attraction.duration }}</div>
            </div>
            <p class="poi-desc" v-if="segment.attraction.description">{{ segment.attraction.description }}</p>
            <div class="poi-tags" v-if="parsedTags(segment.attraction).length">
              <span class="poi-tag" v-for="tag in parsedTags(segment.attraction)" :key="tag">{{ tag }}</span>
            </div>
            <div class="poi-tips" v-if="segment.attraction.tips">
              <span class="poi-tips-icon">💡</span>
              <span class="poi-tips-text">{{ segment.attraction.tips }}</span>
            </div>
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
        <p v-if="!editing" class="feelings-text">
          {{ feelings || '点击右上角编辑，记录今天的旅行感受...' }}
        </p>
        <div v-else>
          <textarea v-model="feelingsDraft" class="notes-textarea" rows="5"></textarea>
          <div class="btn-row">
            <button class="btn secondary" @click="cancelEdit">取消</button>
            <button class="btn primary" @click="saveFeelings">保存</button>
          </div>
        </div>
      </section>

      <section class="card">
        <div class="photo-title-row">
          <div class="photo-title-left">
            <span class="photo-icon">📷</span>
            <span class="photo-title-text">今日照片</span>
          </div>
          <button class="photo-refresh" @click="loadPhotos" v-if="itinerary.id">⟳</button>
        </div>

        <div class="photo-body">
          <div class="photo-upload" @click="triggerPhotoInput" v-if="itinerary.id">
            <div class="photo-upload-plus">＋</div>
            <div class="photo-upload-text">添加照片</div>
          </div>
          <input
            ref="fileInputRef"
            type="file"
            accept="image/*"
            class="photo-input-hidden"
            @change="handlePhotoSelected"
          />

          <div class="photo-list" v-if="photos.length">
            <div
              class="photo-item"
              v-for="(url, idx) in photos"
              :key="idx"
            >
              <img :src="url" alt="行程照片" @click="openPreview(url)" />
              <button class="photo-delete" @click.stop="removePhoto(url)">×</button>
            </div>
          </div>
        </div>
      </section>

      <div
        v-if="previewVisible"
        class="photo-preview-overlay"
        @click="closePreview"
      >
        <div class="photo-preview-content" @click.stop>
          <button class="photo-preview-close" @click="closePreview">×</button>
          <img :src="previewUrl" alt="预览大图" />
        </div>
      </div>
    </main>
  </div>
</template>

<script setup>
import { onMounted, reactive, ref } from 'vue';
import { useRouter } from 'vue-router';

const props = defineProps({
  dayNumber: {
    type: Number,
    default: 1,
  },
});

const API_BASE_URL = 'http://localhost:8080';
const USER_ID = 'default_user';

const router = useRouter();

const itinerary = reactive({
  id: null,
  travelDate: '',
  dayNumber: props.dayNumber,
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
const photos = ref([]);
const fileInputRef = ref(null);
const bannerPhotoUrl = ref('');
const previewVisible = ref(false);
const previewUrl = ref('');

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

async function loadBannerPhoto() {
  try {
    const url = `${API_BASE_URL}/api/poi/photo?keyword=${encodeURIComponent('南京夫子庙')}&city=${encodeURIComponent('南京')}`;
    const data = await fetchJson(url);
    let photoUrl = null;
    if (data) {
      if (typeof data.url === 'string' && data.url) {
        photoUrl = data.url;
      } else if (data.data && typeof data.data === 'string') {
        photoUrl = data.data;
      } else if (data.data && typeof data.data.url === 'string') {
        photoUrl = data.data.url;
      }
    }
    if (photoUrl) {
      bannerPhotoUrl.value = photoUrl;
    }
  } catch (e) {
    console.error('加载 DAY 封面 POI 图失败', e);
  }
}

function openPreview(url) {
  previewUrl.value = url;
  previewVisible.value = true;
}

function closePreview() {
  previewVisible.value = false;
  previewUrl.value = '';
}

async function loadItinerary() {
  try {
    const data = await fetchJson(`${API_BASE_URL}/api/travel/itinerary/user/${USER_ID}/day/${props.dayNumber}`);
    if (data && data.success && data.data) {
      console.log('[Itinerary] 加载成功: ', data.data);
      Object.assign(itinerary, data.data);
      buildRouteMaps();
      await loadPhotos();
      await loadBannerPhoto();
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
    const data = await fetchJson(`${API_BASE_URL}/api/route/map`, {
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
      // 使用轻量级的 marker 策略，仅生成标记点/简单路线URL，避免多个重型导航iframe导致主图白屏
      const body = { locations: [from, to], strategy: 'marker' };
      const data = await fetchJson(`${API_BASE_URL}/api/route/map`, {
        method: 'POST',
        body: JSON.stringify(body),
      });
      const map = data && data.code === 200 && data.data ? data.data.mapUrl : '';
      const attraction = itinerary.attractions
        ? itinerary.attractions.find(a => a.name === to)
        : null;
      result.push({ from, to, transportationInfo: '', mapUrl: map, attraction });
      await new Promise((r) => setTimeout(r, 400));
    } catch (e) {
      console.error('加载分段地图失败', from, to, e);
    }
  }
  segments.value = result;
}

function parsedTags(attraction) {
  if (!attraction || !attraction.tags) return [];
  try {
    if (attraction.tags.trim().startsWith('[')) {
      const arr = JSON.parse(attraction.tags);
      return Array.isArray(arr) ? arr : [];
    }
    return attraction.tags.split(/[;,，]/).map(t => t.trim()).filter(Boolean);
  } catch (e) {
    return [];
  }
}

async function loadFeelings() {
  try {
    const data = await fetchJson(`${API_BASE_URL}/api/travel/itinerary/feelings/${props.dayNumber}?userId=${USER_ID}`);
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
    const body = { userId: USER_ID, dayNumber: props.dayNumber, content: feelingsDraft.value || '' };
    const data = await fetchJson(`${API_BASE_URL}/api/travel/itinerary/feelings`, {
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

function goOverview() {
  router.push('/');
}

function goDay(n) {
  router.push(`/day${n}`);
}

async function loadPhotos() {
  if (!itinerary.id) return;
  try {
    const data = await fetchJson(`${API_BASE_URL}/api/travel/itinerary/${itinerary.id}/photos`);
    if (data && data.success && Array.isArray(data.data)) {
      photos.value = data.data;
    }
  } catch (e) {
    console.error('加载照片失败', e);
  }
}

function triggerPhotoInput() {
  if (fileInputRef.value) {
    fileInputRef.value.value = '';
    fileInputRef.value.click();
  }
}

async function handlePhotoSelected(event) {
  const files = event.target.files;
  if (!files || !files.length || !itinerary.id) return;
  const file = files[0];

  const formData = new FormData();
  formData.append('file', file);

  try {
    await fetch(`${API_BASE_URL}/api/travel/itinerary/${itinerary.id}/photos`, {
      method: 'POST',
      body: formData,
    });
    await loadPhotos();
  } catch (e) {
    console.error('上传照片失败', e);
  }
}

async function removePhoto(url) {
  if (!itinerary.id) return;
  try {
    await fetchJson(`${API_BASE_URL}/api/travel/itinerary/${itinerary.id}/photos`, {
      method: 'DELETE',
      body: JSON.stringify({ photoUrl: url }),
    });
    await loadPhotos();
  } catch (e) {
    console.error('删除照片失败', e);
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
.header-title {
  flex: 1;
  text-align: center;
  font-weight: 600;
}
.banner {
  position: relative;
  height: 180px;
  overflow: hidden;
  background: linear-gradient(to bottom, #f2f4fb, #c0c4d0);
}
.banner-bg {
  position: absolute;
  inset: 0;
  background-size: cover;
  background-position: center;
  filter: brightness(0.8);
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
.day-nav-wrapper {
  background: #eef3ff;
  padding: 12px 0;
}

.day-nav {
  max-width: 100%;
  margin: 0 auto;
  display: flex;
  padding: 4px 12px;
  box-sizing: border-box;
}

.day-tab {
  flex: 1;
  border: none;
  background: transparent;
  padding: 6px 14px;
  font-size: 14px;
  color: #666;
}

.day-tab.active {
  background: #ffffff;
  border-radius: 8px;
  color: #333;
  font-weight: 600;
  box-shadow: 0 2px 6px rgba(0, 0, 0, 0.06);
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
.poi-card {
  display: flex;
  gap: 10px;
  margin-top: 10px;
}

.poi-photo {
  width: 110px;
  height: 80px;
  border-radius: 8px;
  overflow: hidden;
  background: #f0f0f0;
}

.poi-photo img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.poi-info {
  flex: 1;
}

.poi-title-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.poi-name {
  font-size: 14px;
  font-weight: 600;
}

.poi-duration {
  font-size: 12px;
  color: #999;
}

.poi-desc {
  margin: 4px 0;
  font-size: 13px;
  color: #555;
}

.poi-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
  margin-top: 2px;
}

.poi-tag {
  font-size: 11px;
  padding: 2px 6px;
  border-radius: 999px;
  background: #f3f4ff;
  color: #666;
}

.poi-tips {
  margin-top: 6px;
  padding: 6px 8px;
  border-radius: 6px;
  background: #fff7e6;
  font-size: 12px;
  color: #8c6a1a;
  display: flex;
  align-items: flex-start;
  gap: 4px;
}

.poi-tips-icon {
  font-size: 14px;
}

.poi-tips-text {
  flex: 1;
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

.photo-title-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 10px;
}

.photo-title-left {
  display: flex;
  align-items: center;
  gap: 6px;
}

.photo-icon {
  font-size: 16px;
  color: #9254de;
}

.photo-title-text {
  font-size: 15px;
  font-weight: 600;
}

.photo-refresh {
  border: none;
  background: transparent;
  font-size: 16px;
  color: #1677ff;
}

.photo-body {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
}

.photo-upload {
  width: 100px;
  height: 100px;
  border-radius: 10px;
  border: 1px dashed #d9d9d9;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  color: #999;
  cursor: pointer;
}

.photo-upload-plus {
  font-size: 22px;
  line-height: 1;
}

.photo-upload-text {
  margin-top: 4px;
  font-size: 12px;
}

.photo-input-hidden {
  display: none;
}

.photo-list {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
}

.photo-item {
  position: relative;
  width: 100px;
  height: 100px;
  border-radius: 10px;
  overflow: hidden;
}

.photo-item img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.photo-delete {
  position: absolute;
  top: 2px;
  right: 2px;
  width: 18px;
  height: 18px;
  border-radius: 50%;
  border: none;
  background: rgba(0, 0, 0, 0.55);
  color: #fff;
  font-size: 12px;
  line-height: 18px;
}
.photo-preview-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.7);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}
.photo-preview-content {
  position: relative;
  max-width: 90vw;
  max-height: 90vh;
}
.photo-preview-content img {
  max-width: 100%;
  max-height: 100%;
  border-radius: 10px;
}
.photo-preview-close {
  position: absolute;
  top: -10px;
  right: -10px;
  width: 24px;
  height: 24px;
  border-radius: 50%;
  border: none;
  background: rgba(0, 0, 0, 0.75);
  color: #fff;
  font-size: 16px;
}
</style>


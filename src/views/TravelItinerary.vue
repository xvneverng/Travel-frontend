
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
        <div class="banner-name">{{ travelInfo.guideName || '行程名称加载中' }}</div>
        <div class="banner-dest">{{ travelInfo.destination || '目的地' }}</div>
      </div>
    </section>

    <div class="day-nav-wrapper">
      <div class="day-nav">
        <button class="day-tab active">总览</button>
        <button class="day-tab" @click="goDay1">DAY1</button>
        <button class="day-tab" @click="goDay2">DAY2</button>
        <button class="day-tab" @click="goDay3">DAY3</button>
      </div>
    </div>

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
        <div class="card-title-row">
          <div class="card-title">天气预报</div>
          <div class="weather-city" v-if="weatherCity">{{ weatherCity }}</div>
        </div>
        <div v-if="weatherLoading" class="loading">天气预报加载中...</div>
        <div v-else-if="weatherList.length" class="weather-forecast-list">
          <div
            v-for="(item, index) in weatherList"
            :key="index"
            class="weather-forecast-item"
          >
            <div class="weather-forecast-date">{{ item.date }}</div>
            <div class="weather-forecast-icon">{{ item.icon }}</div>
            <div class="weather-forecast-desc">{{ item.desc }}</div>
            <div class="weather-forecast-temp">{{ item.temp }}</div>
          </div>
        </div>
        <div v-else class="loading">暂无天气预报数据</div>
      </section>

      <section class="card">
        <div class="card-title">天气建议</div>
        <div v-if="suggestionsLoading" class="loading">天气建议加载中...</div>
        <div v-else-if="weatherSuggestions.length" class="weather-suggestion">
          <div
            v-for="item in weatherSuggestions"
            :key="item.id"
            class="weather-suggestion-item"
          >
            <div class="weather-suggestion-title">{{ item.suggestionType }}</div>
            <div class="weather-suggestion-content">{{ item.content }}</div>
          </div>
        </div>
        <div v-else class="loading">暂无天气建议</div>
      </section>

      <section class="card">
        <div class="card-title-row">
          <div class="card-title">准备事项</div>
          <button class="primary-btn small" @click="savePreparationItems" :disabled="savingPrep">
            {{ savingPrep ? '保存中...' : '保存进度' }}
          </button>
        </div>
        <div v-if="loadingPrep" class="loading">准备事项加载中...</div>
        <div v-else>
          <div v-for="(category, name) in preparationItems" :key="name" class="prep-group">
            <div class="prep-header">
              <span>{{ name }}</span>
              <span class="prep-progress">
                {{ category.completed }}/{{ category.total }} · {{ category.percentage }}%
              </span>
            </div>
            <ul class="prep-list">
              <li
                v-for="item in category.items"
                :key="item.name"
                class="prep-item"
                @click="toggleItem(name, item)"
              >
                <button class="prep-check" :class="{ done: item.completed }">✔</button>
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
import { onMounted, reactive, ref, computed } from 'vue';
import { useRouter } from 'vue-router';

const API_BASE_URL = 'http://localhost:8080';

const router = useRouter();

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
const savingPrep = ref(false);
const myNotesLocal = ref('');
const bannerPhotoUrl = ref('');
const weatherList = ref([]);
const weatherCity = ref('');
const weatherLoading = ref(false);
const weatherSuggestions = ref([]);
const suggestionsLoading = ref(false);

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
    const data = await fetchJson(`${API_BASE_URL}/api/travel/guide/travel-info`);
    if (data && data.code === 200 && data.data) {
      Object.assign(travelInfo, data.data);
      myNotesLocal.value = data.data.myNotes || '';
      await loadWeatherOverview();
      await loadWeatherSuggestionsOverview();
    }
  } catch (e) {
    console.error('加载行程信息失败', e);
  }
}

async function loadWeatherOverview() {
  // 使用行程目的地和起止日期调用天气预报接口
  const city = travelInfo.destination || '南京';
  if (!city) return;
  weatherLoading.value = true;
  try {
    const params = new URLSearchParams();
    params.append('city', city);
    // 不再传行程起止日期，直接使用后端默认的 5 天天气预报区间（今天~今天+4）
    const data = await fetchJson(`${API_BASE_URL}/api/weather/forecast?${params.toString()}`);
    if (data && data.success && data.data) {
      weatherList.value = Array.isArray(data.data) ? data.data : [];
      weatherCity.value = data.city || city;
    } else {
      weatherList.value = [];
      weatherCity.value = '';
    }
  } catch (e) {
    console.error('加载天气预报失败', e);
    weatherList.value = [];
    weatherCity.value = '';
  } finally {
    weatherLoading.value = false;
  }
}

async function loadWeatherSuggestionsOverview() {
  suggestionsLoading.value = true;
  try {
    const data = await fetchJson(`${API_BASE_URL}/api/weather/suggestions`);
    if (data && data.success && Array.isArray(data.data)) {
      weatherSuggestions.value = data.data;
    } else {
      weatherSuggestions.value = [];
    }
  } catch (e) {
    console.error('加载天气建议失败', e);
    weatherSuggestions.value = [];
  } finally {
    suggestionsLoading.value = false;
  }
}

async function loadPreparationItems() {
  loadingPrep.value = true;
  try {
    const data = await fetchJson(`${API_BASE_URL}/api/travel/guide/preparation-items`);
    if (data && data.code === 200 && data.data) {
      Object.assign(preparationItems, data.data);
    }
  } catch (e) {
    console.error('加载准备事项失败', e);
  } finally {
    loadingPrep.value = false;
  }
}

function recomputeCategoryStats(category) {
  if (!category || !Array.isArray(category.items)) return;
  const total = category.items.length;
  const completed = category.items.filter((it) => it.completed).length;
  category.total = total;
  category.completed = completed;
  category.percentage = total > 0 ? Math.round((completed * 100) / total) : 0;
}

function toggleItem(categoryName, item) {
  const category = preparationItems[categoryName];
  if (!category) return;
  item.completed = !item.completed;
  recomputeCategoryStats(category);
}

async function savePreparationItems() {
  if (savingPrep.value) return;
  savingPrep.value = true;
  try {
    // 后端期望的 preparationItems 结构与当前响应结构一致，可以直接提交
    await fetchJson(`${API_BASE_URL}/api/travel/guide/preparation-items/update`, {
      method: 'POST',
      body: JSON.stringify({
        userId: 'default_user',
        preparationItems,
      }),
    });
  } catch (e) {
    console.error('保存准备事项失败', e);
  } finally {
    savingPrep.value = false;
  }
}

async function loadMyNotes() {
  try {
    const data = await fetchJson(`${API_BASE_URL}/api/travel/guide/my-notes`);
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
    await fetchJson(`${API_BASE_URL}/api/travel/guide/my-notes/update`, {
      method: 'POST',
      body: JSON.stringify({ userId: 'default_user', myNotes: myNotesLocal.value || '' }),
    });
  } catch (e) {
    console.error('保存我的注意事项失败', e);
  } finally {
    saving = false;
  }
}

function goDay1() {
  router.push('/day1');
}

function goDay2() {
  router.push('/day2');
}

function goDay3() {
  router.push('/day3');
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
    console.error('加载南京景点封面图失败', e);
  }
}

onMounted(() => {
  loadTravelInfo();
  loadPreparationItems();
  loadMyNotes();
  loadBannerPhoto();
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
  margin-bottom: 8px;
}
.card-title-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 4px;
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
.weather-city {
  font-size: 12px;
  color: #999;
}
.weather-forecast-list {
  display: flex;
  gap: 8px;
  overflow-x: auto;
  padding-top: 4px;
}
.weather-forecast-item {
  min-width: 90px;
  padding: 8px 6px;
  border-radius: 8px;
  background: #f5f7ff;
  text-align: center;
  font-size: 12px;
}
.weather-forecast-date {
  font-weight: 600;
  margin-bottom: 4px;
}
.weather-forecast-icon {
  font-size: 20px;
  margin-bottom: 2px;
}
.weather-forecast-desc {
  color: #666;
}
.weather-forecast-temp {
  margin-top: 2px;
  color: #1677ff;
}
.weather-suggestion {
  margin-top: 4px;
}
.weather-suggestion-item {
  margin-bottom: 6px;
}
.weather-suggestion-title {
  font-size: 13px;
  font-weight: 600;
  margin-bottom: 2px;
}
.weather-suggestion-content {
  font-size: 12px;
  color: #555;
  line-height: 1.5;
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
  background: #fff;
  cursor: pointer;
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
.primary-btn {
  border: none;
  border-radius: 14px;
  padding: 4px 10px;
  font-size: 12px;
  background: #1677ff;
  color: #fff;
}
.primary-btn.small[disabled] {
  opacity: 0.6;
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


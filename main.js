import { createApp, ref, defineAsyncComponent } from 'https://unpkg.com/vue@3.3.4/dist/vue.esm-browser.prod.js';

const API_BASE_URL = 'http://localhost:8080';

const TravelItinerary = defineAsyncComponent(() => import('./TravelItinerary.vue'));
const TravelDay1 = defineAsyncComponent(() => import('./TravelDay1.vue'));

const App = {
  setup() {
    const currentPage = ref('overview');

    function handleHashChange() {
      const hash = window.location.hash.replace('#', '');
      if (hash === 'day1') {
        currentPage.value = 'day1';
      } else {
        currentPage.value = 'overview';
      }
    }

    window.addEventListener('hashchange', handleHashChange);
    handleHashChange();

    return {
      currentPage,
      API_BASE_URL,
    };
  },
  template: `
    <div class="app-root">
      <component :is="currentPage === 'overview' ? 'TravelItinerary' : 'TravelDay1'"
                 :api-base-url="API_BASE_URL"
                 @go-day1="() => { window.location.hash = 'day1'; }"
                 @go-overview="() => { window.location.hash = ''; }" />
    </div>
  `,
  components: {
    TravelItinerary,
    TravelDay1,
  },
};

createApp(App).mount('#app');

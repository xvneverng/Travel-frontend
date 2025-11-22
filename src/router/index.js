import { createRouter, createWebHashHistory } from 'vue-router';
import TravelItinerary from '../views/TravelItinerary.vue';
import TravelDay from '../views/TravelDay1.vue';
import AIAssistant from '../views/AIAssistant.vue';

const routes = [
  {
    path: '/',
    name: 'ItineraryOverview',
    component: TravelItinerary,
  },
  {
    path: '/day1',
    name: 'TravelDay1',
    component: TravelDay,
    props: { dayNumber: 1 },
  },
  {
    path: '/day2',
    name: 'TravelDay2',
    component: TravelDay,
    props: { dayNumber: 2 },
  },
  {
    path: '/day3',
    name: 'TravelDay3',
    component: TravelDay,
    props: { dayNumber: 3 },
  },
  {
    path: '/ai',
    name: 'AIAssistant',
    component: AIAssistant,
  },
];

const router = createRouter({
  history: createWebHashHistory(),
  routes,
});

export default router;

<template>
  <div class="app-root">
    <div class="app-shell">
      <router-view />
    </div>
  </div>
</template>

<script setup>
</script>

<style scoped>
.app-root {
  min-height: 100vh;
  background: #f5f6fa;
}

.app-shell {
  max-width: 1200px;
  margin: 0 auto;
}

@media (max-width: 768px) {
  .app-shell {
    max-width: 100%;
  }
}
</style>

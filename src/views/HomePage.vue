<script setup lang="ts">
import Map from '../components/Map.vue'
import RoutePlanner from '../components/RoutePlanner.vue'
import { auth } from '../composables/useAuth'
</script>

<template>
  <main class="route-atlas-page">
    <Map :is-logged-in="auth.isLoggedIn" />

    <aside class="today-route-panel">
      <RoutePlanner :is-logged-in="auth.isLoggedIn" />
    </aside>
  </main>
</template>

<style scoped>
.route-atlas-page {
  position: relative;
  width: 100%;
  height: calc(100vh - 68px);
  overflow: hidden;
  background:
    linear-gradient(rgba(224, 217, 203, 0.65) 1px, transparent 1px),
    linear-gradient(90deg, rgba(224, 217, 203, 0.65) 1px, transparent 1px),
    #eae4d8;
  background-size: 48px 48px;
}

.today-route-panel {
  position: absolute;
  top: 30px;
  left: 28px;
  z-index: 30;
  width: 382px;
  max-width: calc(100vw - 56px);
  height: calc(100vh - 108px);
  background: #fcfbf7;
  border: 1px solid #e4ded2;
  box-shadow: 0 22px 48px rgba(33, 29, 24, 0.16);
  overflow: hidden;
}

:deep(.planner-container) {
  height: 100%;
  background: transparent;
}

:deep(.planner-body) {
  height: 100%;
  padding: 0;
  overflow-y: auto;
}

:deep(.planner-mode-banner) {
  display: none;
}

:deep(.route-panel-heading) {
  padding: 24px 24px 18px;
  border-bottom: 1px solid #e4ded2;
}

:deep(.route-panel-kicker) {
  margin-bottom: 9px;
  color: #b85c38;
  font-family: 'IBM Plex Mono', monospace;
  font-size: 0.72rem;
  font-weight: 600;
}

:deep(.plan-title-wrapper) {
  margin: 0;
}

:deep(.plan-title-input) {
  padding: 0;
  border: 0;
  background: transparent;
  color: #211d18;
  font-family: 'Gowun Batang', serif;
  font-size: 1.55rem;
  font-weight: 700;
  line-height: 1.25;
  box-shadow: none;
}

:deep(.plan-title-input::placeholder) {
  color: #9a9286;
  opacity: 1;
}

:deep(.plan-title-input:focus) {
  border: 0;
  box-shadow: none;
}

:deep(.route-panel-stats) {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-top: 17px;
}

:deep(.route-panel-stat) {
  display: inline-flex;
  align-items: center;
  min-height: 24px;
  padding: 4px 9px;
  background: #f1ece1;
  color: #5c554b;
  font-family: 'IBM Plex Mono', monospace;
  font-size: 0.68rem;
  font-weight: 500;
}

:deep(.planner-empty) {
  padding: 52px 24px;
  text-align: left;
}

:deep(.empty-icon) {
  display: none;
}

:deep(.empty-main) {
  margin-bottom: 7px;
  color: #211d18;
  font-family: 'Gowun Batang', serif;
  font-size: 1.05rem;
  font-weight: 700;
}

:deep(.empty-sub) {
  color: #7b7267;
  font-size: 0.88rem;
  line-height: 1.65;
}

:deep(.planner-content) {
  padding: 0 24px 24px;
}

:deep(.planner-content > .plan-title-wrapper) {
  display: none;
}

:deep(.mode-select-row) {
  margin: 18px 0 16px;
  padding: 0;
  background: transparent;
  border: 0;
}

:deep(.mode-label) {
  color: #9a9286;
  font-family: 'IBM Plex Mono', monospace;
  font-size: 0.68rem;
}

:deep(.mode-tab-group) {
  background: #f1ece1;
}

:deep(.mode-tab-btn) {
  padding: 5px 9px;
  font-size: 0.68rem;
}

:deep(.tab-cost-summary) {
  margin: 0 0 16px;
}

:deep(.summary-item) {
  align-items: flex-start;
  padding: 9px 10px;
  background: #f1ece1;
  border: 0;
}

:deep(.route-timeline) {
  gap: 30px;
  margin: 26px 0 0;
}

:deep(.route-item-card) {
  gap: 13px;
  padding: 0;
  background: transparent;
  border: 0;
  box-shadow: none;
}

:deep(.route-item-card:hover) {
  transform: none;
  border-color: transparent;
  box-shadow: none;
}

:deep(.route-badge-num) {
  width: 22px;
  height: 22px;
  background: transparent;
  color: #b85c38;
  font-family: 'IBM Plex Mono', monospace;
  font-size: 0.72rem;
  box-shadow: none;
}

:deep(.route-thumb) {
  width: 52px;
  height: 44px;
  border: 0;
}

:deep(.place-name) {
  font-family: 'Gowun Batang', serif;
  font-size: 1rem;
  font-weight: 700;
}

:deep(.place-addr) {
  color: #7b7267;
  font-size: 0.78rem;
}

:deep(.timeline-connector) {
  margin: -2px 0 14px;
  padding-left: 57px;
  align-items: flex-start;
}

:deep(.connector-line) {
  left: 29px;
  background: repeating-linear-gradient(to bottom, #c8b9a6, #c8b9a6 3px, transparent 3px, transparent 7px);
}

:deep(.dist-badge),
:deep(.fare-badge) {
  border-radius: 0;
  background: #f1ece1;
  border: 0;
  color: #7b7267;
  font-family: 'IBM Plex Mono', monospace;
  font-size: 0.65rem;
}

:deep(.connector-info) {
  flex-wrap: wrap;
  gap: 8px 10px;
  margin-left: 14px;
  transform: translateY(2px);
}

:deep(.fare-badges) {
  gap: 8px;
}

:deep(.route-controls) {
  margin-left: auto;
}

:deep(.planner-footer) {
  margin-top: 24px;
  padding-top: 18px;
  border-top: 1px solid #e4ded2;
}

:deep(.summary-grid.single) {
  display: none;
}

:deep(.action-buttons) {
  display: grid;
  grid-template-columns: 1fr;
}

:deep(.btn-clear-all),
:deep(.btn-optimize),
:deep(.btn-save-plan),
:deep(.btn-add-as-new) {
  width: 100%;
  flex-basis: auto;
  border-radius: 1px;
  padding: 12px 14px;
  font-size: 0.8rem;
}

:deep(.btn-save-plan) {
  background: #b85c38;
  border-color: #b85c38;
}

:deep(.btn-save-plan.magazine) {
  min-height: 48px;
  margin-top: 8px;
  background: #b85c38;
  border: 1px solid #b85c38;
  color: #fcfbf7;
  font-weight: 800;
}

:deep(.btn-save-plan.magazine span:last-child::after) {
  content: " →";
}

:deep(.btn-save-plan.magazine:disabled) {
  background: #d8d1c4;
  border-color: #d8d1c4;
  color: #8b8173;
}

:deep(.notice-tip) {
  display: none;
}

@media (max-width: 768px) {
  .route-atlas-page {
    height: auto;
    min-height: calc(100vh - 68px);
    overflow: visible;
    padding: 14px;
  }

  .today-route-panel {
    position: relative;
    top: auto;
    left: auto;
    width: 100%;
    height: auto;
    min-height: 360px;
    margin-top: 14px;
  }
}
</style>

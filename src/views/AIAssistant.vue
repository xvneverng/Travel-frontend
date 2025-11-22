<template>
  <div class="ai-page">
    <header class="ai-header">
      <div class="ai-title-block">
        <div class="ai-title">AI 个人旅行助手</div>
        <div class="ai-subtitle">一句话描述你的旅行想法</div>
      </div>
      <div class="ai-status" :class="{ running: loading }">
        <span class="dot"></span>
        <span class="text">{{ loading ? '工作流运行中...' : '就绪' }}</span>
      </div>
    </header>

    <main class="ai-main">
      <section class="chat-panel">
        <!-- 推荐问题快捷入口 -->
        <section class="quick-prompts">
          <div class="quick-header-row">
            <div class="quick-title">试试这样问：</div>
            <button class="clear-btn" @click="clearChat">清空记录</button>
          </div>
          <div class="quick-list">
            <button
              v-for="(q, idx) in quickQuestions"
              :key="idx"
              class="quick-chip"
              @click="sendQuickQuestion(q)"
            >
              {{ q }}
            </button>
          </div>
        </section>

        <div class="chat-scroll" ref="scrollRef">
          <div v-for="(msg, idx) in messages" :key="idx" class="chat-row" :class="msg.role">
            <div class="avatar" :class="msg.role">
              <span v-if="msg.role === 'user'">我</span>
              <span v-else></span>
            </div>
            <div class="bubble" v-html="msg.html"></div>
          </div>
        </div>

        <div class="input-bar">
          <textarea
            v-model="userInput"
            class="input-box"
            rows="2"
            :placeholder="placeholder"
            @keydown.enter.prevent="handleEnter"
          ></textarea>
          <button class="send-btn" :disabled="loading || !userInput.trim()" @click="runPlan">
            {{ loading ? '生成中...' : '发送' }}
          </button>
        </div>
      </section>
    </main>
  </div>
</template>

<script setup>
import { ref, computed, nextTick } from 'vue';

const API_BASE_URL = 'http://localhost:8080';

const userInput = ref('');
const loading = ref(false);

// 初始欢迎消息
const initialMessages = [
  {
    role: 'assistant',
    html:
      '<p>你好，我是你的 AI 个人旅行助手。</p>' +
      '<p>上面有一些示例问题，你也可以直接用自己的话描述旅行想法。</p>',
  },
];

const messages = ref([...initialMessages]);

const scrollRef = ref(null);

// 推荐问题列表
const quickQuestions = [
  '我们两个人，下周想去南京玩 3 天，想兼顾美食和人文，帮我出一份详细行程。',
  '一家三口打算五一去杭州自由行 4 天，适合亲子的路线推荐一下。',
  '我和朋友周末想去成都小众景点玩两天，有什么不太拥挤的路线？',
];

const placeholder = computed(
  () =>
    '例如：我们两个人，下周想去南京玩 3 天，要兼顾美食和人文，帮我生成详细行程和路书链接。',
);

function toHtml(text) {
  if (!text) return '';
  return text
    .split('\n')
    .map((line) => `<p>${line.replace(/\s/g, '&nbsp;')}</p>`)
    .join('');
}

async function scrollToBottom() {
  await nextTick();
  const el = scrollRef.value;
  if (el) {
    el.scrollTop = el.scrollHeight;
  }
}

async function runPlan() {
  const content = userInput.value.trim();
  if (!content || loading.value) return;

  // 1. 先把用户输入追加到对话
  messages.value.push({ role: 'user', html: toHtml(content) });
  await scrollToBottom();

  userInput.value = '';
  loading.value = true;

  // 默认使用流式 SSE 输出
  await runPlanStreaming(content).catch(async (e) => {
    console.error('[AIAssistant] 流式模式异常，回退到阻塞模式:', e);
    await runPlanBlocking(content);
  });
}

// 阻塞模式（保留原有逻辑，作为回退）
async function runPlanBlocking(content) {
  const payload = {
    userInput: content,
    userId: 'default_user',
    streaming: false,
  };

  console.log('[AIAssistant] [Blocking] Step1 - 准备发送请求, payload =', payload);

  try {
    const res = await fetch(`${API_BASE_URL}/api/travel/plan/generate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    console.log('[AIAssistant] [Blocking] Step2 - 收到响应, status =', res.status);

    const data = await res.json().catch(() => ({}));

    console.log('[AIAssistant] [Blocking] Step3 - 解析后的响应 data =', data);

    if (!res.ok || data.code !== 200) {
      const msg = `生成失败：HTTP ${res.status}，${data.message || '请稍后重试'}`;
      console.warn('[AIAssistant] [Blocking] Step4-Error - 请求失败, msg =', msg);
      messages.value.push({ role: 'assistant', html: toHtml(msg) });
      await scrollToBottom();
      return;
    }

    const outputs = data.outputs || {};
    console.log('[AIAssistant] [Blocking] Step5 - 工作流 outputs =', outputs);

    const structured = outputs.structured_output || outputs.structuredOutput || {};
    const instruction =
      structured.instruction ||
      structured.Instruction ||
      outputs.instruction ||
      outputs.Instruction ||
      '';

    console.log('[AIAssistant] [Blocking] Step6 - 提取到的 instruction =', instruction);

    let guideHtml = instruction
      ? toHtml(instruction)
      : toHtml('未从工作流中解析到旅游指南文本（instruction）。');

    let link =
      outputs.roadbook_url ||
      outputs.roadbookUrl ||
      outputs.itinerary_url ||
      outputs.itineraryUrl ||
      outputs.link ||
      '';

    console.log('[AIAssistant] [Blocking] Step7 - 初始解析到的路书链接 link =', link);

    if (!link) {
      const values = Object.values(outputs).filter((v) => typeof v === 'string');
      for (const v of values) {
        const match = v.match(/https?:\/\/\S+/);
        if (match) {
          link = match[0];
          console.log('[AIAssistant] [Blocking] Step7b - 从字符串中提取到链接 =', link, '源字段内容 =', v);
          break;
        }
      }
      // 如果 outputs 中没有任何可用链接，则退回到站内默认路书链接
      if (!link) {
        // 使用 hash 路由的首页作为路书总览页，例如 #/
        link = '#/';
        console.log('[AIAssistant] [Blocking] Step7c - 使用默认站内路书链接 =', link);
      }
    }

    if (link) {
      guideHtml += `
        <div class="roadbook-inline">
          <span class="label">AI 路书链接：</span>
          <a href="${link}" target="_blank" rel="noopener noreferrer">打开路书</a>
        </div>`;
    }

    console.log('[AIAssistant] [Blocking] Step8 - 最终发送给聊天窗口的 guideHtml =', guideHtml);

    messages.value.push({ role: 'assistant', html: guideHtml });
    await scrollToBottom();
  } catch (e) {
    const msg = `请求异常：${e && e.message ? e.message : e}`;
    console.error('[AIAssistant] [Blocking] Step-Exception - 请求异常, e =', e);
    messages.value.push({ role: 'assistant', html: toHtml(msg) });
    await scrollToBottom();
  } finally {
    console.log('[AIAssistant] [Blocking] Step9 - 请求结束, 重置 loading');
    loading.value = false;
  }
}

// 流式模式：使用 SSE (Server-Sent Events) 从 /generate/stream 实时接收事件
async function runPlanStreaming(content) {
  return new Promise((resolve, reject) => {
    console.log('[AIAssistant] [Streaming] Step1 - 准备建立 SSE 连接, userInput =', content);

    // 先插入一个空的助手消息，后续不断把内容填充进去
    const assistantMsg = { role: 'assistant', html: toHtml('正在为你规划旅行，请稍候...') };
    messages.value.push(assistantMsg);
    scrollToBottom();

    const params = new URLSearchParams({
      userInput: content,
      userId: 'default_user',
    });

    const url = `${API_BASE_URL}/api/travel/plan/generate/stream?${params.toString()}`;
    const es = new EventSource(url);

    let finished = false;

    es.onopen = () => {
      console.log('[AIAssistant] [Streaming] Step2 - SSE 连接已建立');
    };

    es.addEventListener('workflow_finished', async (event) => {
      console.log('[AIAssistant] [Streaming] 收到 workflow_finished 事件:', event.data);
      try {
        const payload = JSON.parse(event.data || '{}');
        const data = payload.data || {};
        const outputs = data.outputs || {};

        console.log('[AIAssistant] [Streaming] outputs =', outputs);

        const structured = outputs.structured_output || outputs.structuredOutput || {};
        const instruction =
          structured.instruction ||
          structured.Instruction ||
          outputs.instruction ||
          outputs.Instruction ||
          '';

        console.log('[AIAssistant] [Streaming] instruction =', instruction);

        let guideHtml = instruction
          ? toHtml(instruction)
          : toHtml('未从工作流中解析到旅游指南文本（instruction）。');

        let link =
          outputs.roadbook_url ||
          outputs.roadbookUrl ||
          outputs.itinerary_url ||
          outputs.itineraryUrl ||
          outputs.link ||
          '';

        if (!link) {
          const values = Object.values(outputs).filter((v) => typeof v === 'string');
          for (const v of values) {
            const match = v.match(/https?:\/\/\S+/);
            if (match) {
              link = match[0];
              console.log('[AIAssistant] [Streaming] 从字符串中提取到链接 =', link, '源字段内容 =', v);
              break;
            }
          }
          // 如果 outputs 中没有任何可用链接，则退回到站内默认路书链接
          if (!link) {
            // 使用 hash 路由的首页作为路书总览页，例如 #/
            link = '#/';
            console.log('[AIAssistant] [Streaming] 使用默认站内路书链接 =', link);
          }
        }

        if (link) {
          guideHtml += `
            <div class="roadbook-inline">
              <span class="label">AI 路书链接：</span>
              <a href="${link}" target="_blank" rel="noopener noreferrer">打开路书</a>
            </div>`;
        }

        assistantMsg.html = guideHtml;
        await scrollToBottom();
        finished = true;
        es.close();
        loading.value = false;
        resolve(null);
      } catch (err) {
        console.error('[AIAssistant] [Streaming] 处理 workflow_finished 数据异常:', err);
        es.close();
        loading.value = false;
        reject(err);
      }
    });

    es.addEventListener('error', (event) => {
      console.error('[AIAssistant] [Streaming] SSE 发生错误:', event);
      if (!finished) {
        es.close();
        loading.value = false;
        reject(new Error('SSE 连接出错'));
      }
    });

    // 其他事件（如 workflow_started/node_started 等）目前只做日志记录，未来可用于更细粒度的进度展示
    es.addEventListener('workflow_started', (event) => {
      console.log('[AIAssistant] [Streaming] workflow_started:', event.data);
    });
    es.addEventListener('node_started', (event) => {
      console.log('[AIAssistant] [Streaming] node_started:', event.data);
    });
    es.addEventListener('node_finished', (event) => {
      console.log('[AIAssistant] [Streaming] node_finished:', event.data);
    });
  });
}

function handleEnter() {
  runPlan();
}

async function sendQuickQuestion(q) {
  if (loading.value) return;
  userInput.value = q;
  await runPlan();
}

function clearChat() {
  if (loading.value) return;
  messages.value = [...initialMessages];
  userInput.value = '';
}
</script>

<style scoped>
.ai-page {
  min-height: 100vh;
  background: radial-gradient(circle at top left, #020617, #020617 45%, #0f172a 100%);
  color: #e5e7eb;
  display: flex;
  flex-direction: column;
}

.ai-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 14px 20px;
  border-bottom: 1px solid rgba(148, 163, 184, 0.25);
  backdrop-filter: blur(18px);
  background: linear-gradient(to right, rgba(15, 23, 42, 0.9), rgba(15, 23, 42, 0.6));
}

.ai-title-block {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.ai-title {
  font-size: 20px;
  font-weight: 600;
}

.ai-subtitle {
  font-size: 12px;
  color: #9ca3af;
}

.ai-status {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 4px 10px;
  border-radius: 999px;
  font-size: 12px;
  background: rgba(15, 23, 42, 0.8);
  border: 1px solid rgba(56, 189, 248, 0.6);
}

.ai-status .dot {
  width: 8px;
  height: 8px;
  border-radius: 999px;
  background: #22c55e;
  box-shadow: 0 0 8px #4ade80;
}

.ai-status.running .dot {
  background: #f97316;
  box-shadow: 0 0 8px #fb923c;
}

.ai-main {
  flex: 1;
  display: flex;
  justify-content: center;
  padding: 18px 12px 20px;
}

.chat-panel {
  width: 100%;
  max-width: 880px;
  background: rgba(15, 23, 42, 0.9);
  border-radius: 18px;
  border: 1px solid rgba(148, 163, 184, 0.4);
  box-shadow: 0 18px 45px rgba(0, 0, 0, 0.7);
  display: flex;
  flex-direction: column;
}

.chat-scroll {
  flex: 1;
  padding: 16px 18px 10px;
  overflow-y: auto;
}

.chat-row {
  display: flex;
  gap: 8px;
  margin-bottom: 10px;
}

.chat-row.user {
  flex-direction: row-reverse;
}

.avatar {
  width: 32px;
  height: 32px;
  border-radius: 40px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 11px;
  font-weight: 600;
  border: 2px solid rgba(15, 23, 42, 0.9);
  box-shadow: 0 0 0 2px rgba(15, 23, 42, 0.9), 0 4px 10px rgba(15, 23, 42, 0.6);
  color: #0f172a;
  background: #e5e7eb;
  position: relative;
  overflow: hidden;
}

.avatar.user {
  background: radial-gradient(circle at 30% 20%, #fee2e2, #fb923c);
  color: #111827;
}

.avatar.assistant {
  background: radial-gradient(circle at 30% 20%, #e0f2fe, #4f46e5);
  color: #0f172a;
}

.avatar::before,
.avatar::after {
  content: '';
  position: absolute;
  top: 40%;
  width: 4px;
  height: 4px;
  border-radius: 999px;
  background: rgba(15, 23, 42, 0.9);
}

.avatar::before {
  left: 35%;
}

.avatar::after {
  right: 35%;
}

.avatar span {
  position: relative;
  z-index: 1;
}

.bubble {
  max-width: 80%;
  padding: 8px 11px;
  border-radius: 14px;
  font-size: 13px;
  line-height: 1.7;
  background: rgba(15, 23, 42, 0.9);
  border: 1px solid rgba(148, 163, 184, 0.4);
}

.chat-row.user .bubble {
  background: linear-gradient(to right, #0ea5e9, #22c55e);
  border-color: transparent;
}

.bubble p {
  margin: 0 0 4px;
}

.bubble p:last-child {
  margin-bottom: 0;
}

.quick-prompts {
  padding: 10px 16px 4px;
  border-bottom: 1px solid rgba(31, 41, 55, 0.7);
  background: radial-gradient(circle at top left, rgba(15,23,42,0.95), rgba(15,23,42,0.85));
}

.quick-header-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 8px;
}

.quick-title {
  font-size: 12px;
  color: #9ca3af;
  margin-bottom: 6px;
}

.quick-list {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.clear-btn {
  border: none;
  border-radius: 999px;
  padding: 3px 10px;
  font-size: 11px;
  background: rgba(15, 23, 42, 0.9);
  color: #9ca3af;
  border: 1px solid rgba(148, 163, 184, 0.5);
  cursor: pointer;
}

.clear-btn:hover {
  color: #e5e7eb;
  border-color: rgba(248, 250, 252, 0.8);
}

.quick-chip {
  border: none;
  border-radius: 999px;
  padding: 4px 10px;
  font-size: 12px;
  background: rgba(15, 23, 42, 0.95);
  color: #e5e7eb;
  border: 1px solid rgba(56, 189, 248, 0.6);
  cursor: pointer;
  max-width: 100%;
  text-align: left;
}

.quick-chip:hover {
  background: rgba(8, 47, 73, 0.95);
}

.roadbook-inline {
  margin-top: 6px;
  padding-top: 6px;
  border-top: 1px dashed rgba(148, 163, 184, 0.6);
  font-size: 12px;
}

.roadbook-inline .label {
  color: #9ca3af;
  margin-right: 6px;
}

.roadbook-inline a {
  color: #22c55e;
  text-decoration: underline;
}

.input-bar {
  display: flex;
  gap: 8px;
  padding: 10px 12px 12px;
  border-top: 1px solid rgba(31, 41, 55, 0.9);
}

.input-box {
  flex: 1;
  border-radius: 14px;
  border: 1px solid rgba(148, 163, 184, 0.5);
  background: rgba(15, 23, 42, 0.95);
  color: #e5e7eb;
  padding: 8px 10px;
  font-size: 13px;
  resize: none;
}

.input-box::placeholder {
  color: #6b7280;
}

.send-btn {
  border-radius: 999px;
  border: none;
  padding: 0 16px;
  font-size: 13px;
  background: linear-gradient(to right, #0ea5e9, #22c55e);
  color: #f9fafb;
  cursor: pointer;
}

.send-btn[disabled] {
  opacity: 0.6;
  cursor: default;
}

@media (max-width: 768px) {
  .chat-panel {
    border-radius: 0;
    border-left: none;
    border-right: none;
  }

  .chat-scroll {
    padding-inline: 12px;
  }
}
</style>

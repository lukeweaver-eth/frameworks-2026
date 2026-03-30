<template>
  <div
    class="embed"
    @touchmove.stop.prevent="() => null"
  >
    <video
      v-if="isPlayable"
      :autoplay="autoplay"
      :loop="loop"
      :muted="muted"
      :controls="controls"
      playsinline
      crossorigin="anonymous"
    >
      <source :src="src" :type="mediaType">
      Your browser does not support the video tag.
    </video>
    <iframe
      v-else
      ref="frame"
      frameborder="0"
      :src="src"
      sandbox="allow-scripts allow-same-origin"
      allow="webgpu; fullscreen"
    ></iframe>
  </div>
</template>

<script setup lang="ts">
import { useWindowSize } from '@vueuse/core'

async function fetchMediaType(url: string): Promise<string | null> {
  try {
    const response = await fetch(url, { method: 'HEAD' })
    if (!response.ok) return null
    const contentType = response.headers.get('Content-Type')
    return contentType ? contentType.split(';')[0] : null
  } catch {
    return null
  }
}

const config = useRuntimeConfig()
const props = defineProps({
  src: String,
  muted: { type: Boolean, default: true },
  loop: { type: Boolean, default: true },
  autoplay: { type: Boolean, default: true },
  controls: { type: Boolean, default: false },
})

const src = ref()
const mediaType = ref()
const isPlayable = computed(() => {
  if (!mediaType.value) return false
  return document.createElement('video').canPlayType(mediaType.value) !== ''
})

watchEffect(async () => {
  src.value = validateURI(props.src, config.public)
  mediaType.value = await fetchMediaType(src.value)
})

const { width } = useWindowSize()
watch(width, () => {
  src.value = ''
  nextTick(() => { src.value = props.src })
})
</script>

<style scoped>
.embed {
  width: 100%;
  max-height: 100cqmin;
  display: grid;
  align-items: center;
  justify-content: center;
  position: relative;
  touch-action: none;
  container-type: inline-size;

  video,
  iframe {
    width: 100cqw;
    max-width: 100cqmin;
    max-height: 100cqmin;
    aspect-ratio: 1/1 auto;
  }

  iframe {
    pointer-events: all;
  }
}
</style>

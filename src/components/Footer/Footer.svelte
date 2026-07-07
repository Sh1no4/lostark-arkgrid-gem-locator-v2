<script lang="ts">
  import { onMount } from 'svelte';

  import { DISCORD_URL, KAKAOTALK_URL } from '../../lib/constants/enums';
  import Credit from './Credit.svelte';
  import Policy from './Policy.svelte';
  import Terms from './Terms.svelte';

  onMount(() => {
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = 'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/7.0.1/css/all.min.css';
    link.crossOrigin = 'anonymous';
    link.referrerPolicy = 'no-referrer';
    document.head.appendChild(link);
  });

  let dialog = $state<HTMLDialogElement>();
  type Footers = 'credit' | 'policy' | 'terms';
  let currentFooter = $state<Footers | null>(null);

  const openDialong = (component: Footers) => {
    currentFooter = component;
    if (dialog) dialog.showModal();
  };

  const closeDialog = () => {
    if (dialog) dialog.close();
    currentFooter = null;
  };
</script>

<dialog
  class="footer-dialog"
  bind:this={dialog}
  onclick={(e) => {
    if (e.target === dialog) closeDialog();
  }}
>
  {#if currentFooter === 'credit'}
    <Credit />
  {:else if currentFooter === 'policy'}
    <Policy />
  {:else if currentFooter === 'terms'}
    <Terms />
  {/if}
</dialog>

<div class="container">
  <a class="footer-link" href="#credits" onclick={() => openDialong('credit')}>Credits</a>

  <a class="footer-link" href="#privacy" onclick={() => openDialong('policy')}>Privacy Policy</a>

  <a class="footer-link" href="#terms" onclick={() => openDialong('terms')}>Terms</a>
  <a href={DISCORD_URL} target="_blank" rel="noopener noreferrer" class="footer-link">
    <i class="fa-brands fa-discord"></i>
    Discord
  </a>
  <a href={KAKAOTALK_URL} target="_blank" rel="noopener noreferrer" class="footer-link">
    <i class="fa-brands fa-kakao-talk"></i>
    KakaoTalk
  </a>
</div>

<style>
  .container {
    font-size: 0.8rem;
    display: flex;
    flex-direction: row;
    text-align: center;
    justify-content: center;
    align-items: center;
    gap: 0.75rem;
    flex-wrap: wrap;
    padding: 0.75rem 0;
    color: var(--subtle-text);
  }
  .footer-dialog {
    width: min(32rem, calc(100vw - 2rem));
  }
  .footer-link {
    color: var(--subtle-text);
    text-decoration: none;
    cursor: pointer;
  }

  .footer-link:hover {
    color: var(--text);
  }
</style>

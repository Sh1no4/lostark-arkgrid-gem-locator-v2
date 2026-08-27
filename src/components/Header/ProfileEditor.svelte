<script lang="ts">
  import { toast } from '@zerodevx/svelte-toast';

  import { DEFAULT_PROFILE_NAME, L_DEFAULT_PROFILE_NAME } from '../../lib/constants/enums';
  import { LCancel, LConfirm } from '../../lib/constants/localization';
  import {
    addNewProfile,
    appConfig,
    bigIntSerializer,
    getProfile,
  } from '../../lib/state/appConfig.state.svelte';
  import { appLocale } from '../../lib/state/locale.state.svelte';
  import {
    type CharacterProfile,
    currentProfileName,
    deleteProfile,
    imgRoleCombat,
    imgRoleSupporter,
    initNewProfile,
    migrateProfile,
    setCurrentProfileName,
    updateProfileCharacterName,
  } from '../../lib/state/profile.state.svelte';

  let locale = $derived(appLocale.current);
  const LTitle = $derived(
    {
      ko_kr: '프로필',
      en_us: 'Profile',
      zh_cn: '配置',
    }[locale]
  );
  const LAddNewProfile = $derived(
    {
      ko_kr: '새 프로필에 사용할 캐릭터명을 입력해주세요.',
      en_us: 'Enter a name for the new profile.',
      zh_cn: '请输入新配置使用的角色名称。',
    }[locale]
  );
  const LNewProfile = $derived(
    {
      ko_kr: '프로필 추가',
      en_us: 'Create Profile',
      zh_cn: '创建配置',
    }[locale]
  );
  const LConfirmDeleteProfile: Record<string, (profileName: string) => string> = {
    ko_kr: (name) => `"${name}" 프로필을 삭제하시겠습니까?`,
    en_us: (name) => `Are you sure you want to delete the "${name}" profile?`,
    zh_cn: (name) => `确定要删除配置“${name}”吗？`,
  };
  const LDeleteProfile = $derived(
    {
      ko_kr: '현재 프로필 삭제',
      en_us: 'Delete current profile',
      zh_cn: '删除当前配置',
    }[locale]
  );
  const LEditProfile = $derived(
    {
      ko_kr: '현재 프로필 수정',
      en_us: 'Edit current profile',
      zh_cn: '编辑当前配置',
    }[locale]
  );
  const LEditProfileMsg = $derived(
    {
      ko_kr: '변경할 프로필 이름을 입력해주세요.',
      en_us: 'Enter a new name for the profile.',
      zh_cn: '请输入新的配置名称。',
    }[locale]
  );
  const LEditProfileFailedMsg = $derived(
    {
      ko_kr: '중복된 프로필 이름이 존재합니다.',
      en_us: 'A profile with this name already exists.',
      zh_cn: '已存在相同名称的配置。',
    }[locale]
  );
  const LNameRequired = $derived(
    {
      ko_kr: '프로필 이름을 입력해주세요.',
      en_us: 'Enter a profile name.',
      zh_cn: '请输入配置名称。',
    }[locale]
  );
  const LNameTooLong = $derived(
    {
      ko_kr: '프로필 이름은 16자 이하여야 합니다.',
      en_us: 'Profile names must be 16 characters or fewer.',
      zh_cn: '配置名称不能超过 16 个字符。',
    }[locale]
  );
  const LExportProfile = $derived(
    {
      ko_kr: '프로필 내보내기 (JSON)',
      en_us: 'Export current profile as JSON',
      zh_cn: '导出配置 (JSON)',
    }[locale]
  );
  const LImportProfile = $derived(
    {
      ko_kr: '프로필 불러오기 (JSON)',
      en_us: 'Import profile from JSON',
      zh_cn: '导入配置 (JSON)',
    }[locale]
  );
  const LImportProfileFailedMsgDuplicated = $derived(
    {
      ko_kr: '중복된 프로필 이름이 존재합니다.',
      en_us: 'A profile with this name already exists.',
      zh_cn: '已存在相同名称的配置。',
    }[locale]
  );
  const LImportProfileFailedMsgWrongFormat = $derived(
    {
      ko_kr: '올바르지 않은 프로필 파일입니다.',
      en_us: 'Failed to import the profile file due to an invalid file format.',
      zh_cn: '配置文件格式不正确。',
    }[locale]
  );
  const LSupporterRole = $derived(
    {
      ko_kr: '서포터',
      en_us: 'Supporter',
      zh_cn: '辅助',
    }[locale]
  );
  const LCombatRole = $derived(
    {
      ko_kr: '딜러',
      en_us: 'Combat',
      zh_cn: '输出',
    }[locale]
  );
  const LSelectProfile = $derived(
    {
      ko_kr: '프로필 선택',
      en_us: 'Select profile',
      zh_cn: '选择配置',
    }[locale]
  );

  type DialogMode = 'add' | 'rename' | 'delete';
  let profileDialog = $state<HTMLDialogElement>();
  let dialogMode = $state<DialogMode | null>(null);
  let nameInput = $state('');
  let dialogError = $state('');
  const nameInputId = 'profile-name-input';

  const dialogTitle = $derived(
    dialogMode === 'add' ? LNewProfile : dialogMode === 'rename' ? LEditProfile : LDeleteProfile
  );
  const dialogDescription = $derived(
    dialogMode === 'add'
      ? LAddNewProfile
      : dialogMode === 'rename'
        ? LEditProfileMsg
        : LConfirmDeleteProfile[locale](currentProfileName.current)
  );

  function openProfileDialog(mode: DialogMode) {
    dialogMode = mode;
    nameInput = mode === 'rename' ? currentProfileName.current : '';
    dialogError = '';
    profileDialog?.showModal();
  }

  function closeProfileDialog() {
    profileDialog?.close();
  }

  function handleDialogClose() {
    dialogMode = null;
    nameInput = '';
    dialogError = '';
  }

  function submitProfileDialog(event: SubmitEvent) {
    event.preventDefault();
    if (dialogMode === 'delete') {
      deleteProfile(currentProfileName.current);
      closeProfileDialog();
      return;
    }

    const profileName = nameInput.trim();
    if (profileName.length === 0) {
      dialogError = LNameRequired;
      return;
    }
    if (profileName.length > 16) {
      dialogError = LNameTooLong;
      return;
    }

    if (dialogMode === 'add') {
      if (!addNewProfile(initNewProfile(profileName))) {
        dialogError = LEditProfileFailedMsg;
        return;
      }
      setCurrentProfileName(profileName);
      closeProfileDialog();
      return;
    }

    if (updateProfileCharacterName(profileName) === false) {
      dialogError = LEditProfileFailedMsg;
      return;
    }
    setCurrentProfileName(profileName);
    closeProfileDialog();
  }

  function exportCurrentProfile() {
    const jsonStr = bigIntSerializer.stringify(getProfile(currentProfileName.current));
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${currentProfileName.current}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  function importProfileFromJson() {
    const fileInput = document.createElement('input');
    fileInput.type = 'file';
    fileInput.accept = '.json';

    fileInput.addEventListener('change', (event) => {
      const target = event.target as HTMLInputElement;
      const file = target.files?.[0];
      if (!file) return;

      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const data: CharacterProfile = bigIntSerializer.parse(e.target?.result as string);
          migrateProfile(data);
          if (addNewProfile(data)) {
            currentProfileName.current = data.characterName;
          } else {
            toast.push(LImportProfileFailedMsgDuplicated);
          }
        } catch {
          toast.push(LImportProfileFailedMsgWrongFormat);
        }
      };
      reader.readAsText(file);
      fileInput.remove();
    });
    fileInput.click();
  }
</script>

<div class="root">
  <div class="title">{LTitle}</div>
  <div class="buttons">
    {#each appConfig.current.characterProfiles as profile}
      <button
        type="button"
        class="profile-select-button"
        onclick={() => setCurrentProfileName(profile.characterName)}
        class:active={profile.characterName === currentProfileName.current}
        aria-pressed={profile.characterName === currentProfileName.current}
        aria-label={`${LSelectProfile}: ${profile.characterName === DEFAULT_PROFILE_NAME ? L_DEFAULT_PROFILE_NAME[locale] : profile.characterName}`}
      >
        {profile.characterName === DEFAULT_PROFILE_NAME
          ? L_DEFAULT_PROFILE_NAME[locale]
          : profile.characterName}
        {#if profile.characterName !== DEFAULT_PROFILE_NAME}
          <img
            src={profile.isSupporter ? imgRoleSupporter : imgRoleCombat}
            alt={profile.isSupporter ? LSupporterRole : LCombatRole}
          />
        {/if}
      </button>
    {/each}
    <button
      type="button"
      title={LNewProfile}
      aria-label={LNewProfile}
      onclick={() => openProfileDialog('add')}
      data-track="add-profile">➕</button
    >
    <button
      type="button"
      title={LEditProfile}
      aria-label={LEditProfile}
      disabled={currentProfileName.current === DEFAULT_PROFILE_NAME}
      onclick={() => openProfileDialog('rename')}>✏️</button
    >
    <button
      type="button"
      title={LDeleteProfile}
      aria-label={LDeleteProfile}
      onclick={() => openProfileDialog('delete')}
      disabled={currentProfileName.current === DEFAULT_PROFILE_NAME}>🗑️</button
    >
    <button
      type="button"
      title={LExportProfile}
      aria-label={LExportProfile}
      disabled={currentProfileName.current === DEFAULT_PROFILE_NAME}
      onclick={exportCurrentProfile}>💾</button
    >
    <button
      type="button"
      title={LImportProfile}
      aria-label={LImportProfile}
      onclick={importProfileFromJson}
    >
      📂
    </button>
  </div>
</div>

<dialog
  class="profile-dialog"
  bind:this={profileDialog}
  aria-labelledby="profile-dialog-title"
  onclose={handleDialogClose}
  onclick={(event) => {
    if (event.target === profileDialog) closeProfileDialog();
  }}
>
  {#if dialogMode}
    <form class="profile-dialog__form" onsubmit={submitProfileDialog}>
      <h2 id="profile-dialog-title">{dialogTitle}</h2>
      <p class="profile-dialog__copy">{dialogDescription}</p>
      {#if dialogMode !== 'delete'}
        <label class="profile-dialog__field" for={nameInputId}>{LTitle}</label>
        <input
          id={nameInputId}
          bind:value={nameInput}
          maxlength="16"
          autocomplete="off"
          aria-invalid={dialogError ? 'true' : 'false'}
        />
      {/if}
      {#if dialogError}
        <p class="profile-dialog__error" role="alert">{dialogError}</p>
      {/if}
      <div class="profile-dialog__actions">
        <button type="button" onclick={closeProfileDialog}>{LCancel[locale]}</button>
        <button type="submit">{LConfirm[locale]}</button>
      </div>
    </form>
  {/if}
</dialog>

<style>
  .root {
    display: flex;
    flex-direction: row;
    gap: 10px;
    align-items: center;
    user-select: none;
    flex-wrap: wrap;
  }
  .title {
    font-weight: 700;
    font-size: 1.4rem;
  }
  .profile-select-button {
    /* 추가, 삭제 버튼과 구분되게 좀 크게 */
    height: 2.6rem;
    display: flex;
    flex-direction: row;
    align-items: center;
    gap: 0.2rem;
    box-sizing: border-box;
  }
  .profile-select-button > img {
    height: 1.2rem;
    box-sizing: border-box;
  }
  .buttons {
    display: flex;
    align-items: flex-end;
    gap: 0.5rem;
    flex-wrap: wrap;
  }
  button {
    background-color: var(--card);
  }
  button:hover {
    background-color: var(--card-inner);
  }
  button.active {
    background-color: var(--card-inner);
    font-weight: bold;
    border: 2px solid;
  }

  .profile-dialog {
    width: min(22rem, calc(100vw - 2rem));
    padding: 1rem;
    border: 1px solid var(--reference-border, var(--border));
    border-radius: 0.75rem;
    background: var(--reference-card, var(--card));
    color: var(--text);
  }

  .profile-dialog__form {
    display: flex;
    flex-direction: column;
    gap: 0.65rem;
  }

  .profile-dialog__form h2 {
    margin: 0;
    font-size: 1rem;
    font-weight: 800;
  }

  .profile-dialog__copy,
  .profile-dialog__error {
    margin: 0;
    font-size: 0.88rem;
    line-height: 1.4;
  }

  .profile-dialog__copy {
    color: var(--subtle-text);
  }

  .profile-dialog__error {
    color: var(--reference-danger);
  }

  .profile-dialog__field {
    font-size: 0.82rem;
    font-weight: 700;
  }

  .profile-dialog__form input {
    min-height: 2.4rem;
    padding: 0.45rem 0.65rem;
    border-radius: 0.5rem;
  }

  .profile-dialog__actions {
    display: flex;
    justify-content: flex-end;
    gap: 0.5rem;
  }
</style>

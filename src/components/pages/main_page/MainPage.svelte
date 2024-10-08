<script lang="ts">
  import Icon from '~/tools/Icon.svelte';
  import { onDestroy, onMount } from 'svelte';
  import { delay } from '~/tools/delay';
  import { get, writable, type Unsubscriber } from 'svelte/store';
  import {
    LANG_LIST,
    SCRIPT_LIST,
    type lang_list_type,
    type script_list_type
  } from '~/tools/lang_list';
  import LipiLekhikA, { load_parivartak_lang_data, lipi_parivartak_async } from '~/tools/converter';
  import { LanguageIcon } from '~/components/icons';
  import { ensure_auth_access_status, get_id_token_info } from '~/tools/auth_tools';
  import { browser } from '$app/environment';
  import SargaDisplay from './display/SargaDisplay.svelte';
  import { get_possibily_not_undefined } from '~/tools/kry';
  import { BiEdit, BiHelpCircle } from 'svelte-icons-pack/bi';
  import { scale, slide } from 'svelte/transition';
  import { TiArrowBackOutline, TiArrowForwardOutline } from 'svelte-icons-pack/ti';
  import { user_info } from '~/state/main_page/user';
  import { goto } from '$app/navigation';
  import Select from '~/components/Select.svelte';
  import { z } from 'zod';
  import { createMutation, createQuery, useQueryClient } from '@tanstack/svelte-query';
  import {
    kANDa_selected,
    sarga_selected,
    editing_status_on,
    BASE_SCRIPT,
    viewing_script,
    trans_lang,
    view_translation_status,
    edit_language_typer_status,
    sanskrit_mode,
    typing_assistance_modal_opened,
    image_tool_opened,
    ai_tool_opened
  } from '~/state/main_page/main_state';
  import { user_allowed_langs } from '~/state/main_page/user';
  import { SlideToggle } from '@skeletonlabs/skeleton';
  import { BsKeyboard } from 'svelte-icons-pack/bs';
  import User from './user/User.svelte';
  import { get_script_for_lang, get_text_font_class } from '~/tools/font_tools';
  import {
    LOCALS_TRANS_LANGS,
    rAmAyaNam_map,
    get_kANDa_names,
    get_sarga_names
  } from '~/state/main_page/data';
  import MetaTags from '~/components/tags/MetaTags.svelte';
  import { loadLocalConfig } from './load_local_config';

  const unsubscribers: Unsubscriber[] = [];
  const query_client = useQueryClient();

  let mounted = false;
  onMount(async () => {
    if (browser) await ensure_auth_access_status();
    try {
      $user_info = get_id_token_info().user;
    } catch {}
    if (import.meta.env.DEV) {
      (async () => {
        const conf = await loadLocalConfig();
        if (conf.view_translation_status) $view_translation_status = true;
        if (conf.trans_lang)
          $trans_lang_mut.mutateAsync('Hindi').then(() => {
            editing_status_on.set(true);
          });
        if (conf.editing_status_on) $editing_status_on = true;
        if (conf.image_tool_opened) $image_tool_opened = true;
        if (conf.ai_tool_opened) {
          $ai_tool_opened = true;
          $view_translation_status = true;
        }
      })();
    }
    if (browser && import.meta.env.PROD) {
      window.addEventListener('beforeunload', function (e) {
        if ($editing_status_on) {
          e.preventDefault(); // If you prevent default behavior in Mozilla Firefox prompt will always be shown
          e.returnValue = ''; // Chrome requires returnValue to be set
        }
      });
    }
    await load_parivartak_lang_data(BASE_SCRIPT);
    mounted = true;
  });
  const params_viewing_script_mut_schema = z.object({
    script: z.string(),
    update_viewing_script_selection: z.boolean().default(true)
  });
  let viewing_script_selection = writable(BASE_SCRIPT);
  let viewing_script_mut = createMutation({
    mutationKey: ['viewing_script'],
    mutationFn: async (params: z.infer<typeof params_viewing_script_mut_schema>) => {
      const args = params_viewing_script_mut_schema.parse(params);
      const script = args.script as script_list_type;
      if (!mounted) return script;
      await delay(500);
      await load_parivartak_lang_data(script);
      return script;
    },
    onSuccess(script, { update_viewing_script_selection }) {
      $viewing_script = script;
      if (update_viewing_script_selection) $viewing_script_selection = script;
    }
  });
  unsubscribers.push(
    viewing_script_selection.subscribe(async (script) => {
      $viewing_script_mut.mutate({
        script,
        update_viewing_script_selection: false
      });
    })
  );

  let trans_lang_selection = writable<typeof $trans_lang>('--');
  $trans_lang = $trans_lang_selection;
  const trans_lang_mut = createMutation({
    mutationKey: ['trans_lang'],
    mutationFn: async (lang: typeof $trans_lang) => {
      if (!mounted || !browser || lang === '--') return lang;
      // loading trnaslation lang data for typing support
      await delay(300);
      let script = get_script_for_lang(lang);
      await Promise.all([
        $viewing_script_mut.mutateAsync({ script, update_viewing_script_selection: true }),
        load_parivartak_lang_data(lang)
      ]);
      return lang;
    },
    onSuccess(lang) {
      $trans_lang_selection = lang;
      $trans_lang = lang;
      query_client.invalidateQueries({ queryKey: ['sanskrit_mode_texts'] });
    }
  });
  unsubscribers.push(
    trans_lang_selection.subscribe(async (lang) => {
      $trans_lang_mut.mutate(lang);
    })
  );
  // the trans_lang_mut is used to get the translation language
  // this could be removed in future in favour of a simple query

  const get_ramayanam_page_link = (kANDa: number, sarga: number | null = null) => {
    return `/${kANDa}${sarga ? `/${sarga}` : ''}`;
  };

  let kANDa_names = rAmAyaNam_map.map((kANDa) => kANDa.name_devanagari);
  $: get_kANDa_names($viewing_script).then((names) => (kANDa_names = names));
  let sarga_names =
    $kANDa_selected !== 0
      ? rAmAyaNam_map[$kANDa_selected - 1].sarga_data.map((sarga) => sarga.name_devanagari)
      : [];
  $: get_sarga_names($kANDa_selected, $viewing_script).then((names) => (sarga_names = names));

  unsubscribers.push(
    sarga_selected.subscribe(async () => {
      if ($kANDa_selected === 0 || $sarga_selected === 0) return;
      if (!browser) return;
      if (browser && mounted) {
        // console.log([$kANDa_selected, $sarga_selected]);
        goto(get_ramayanam_page_link($kANDa_selected, $sarga_selected));
      }
    })
  );
  unsubscribers.push(
    kANDa_selected.subscribe(() => {
      browser && mounted && ($sarga_selected = 0);
      if (browser && mounted) {
        if ($kANDa_selected !== 0 && $sarga_selected === 0) {
          // console.log('kanda page', [$kANDa_selected, $sarga_selected]);
          goto(get_ramayanam_page_link($kANDa_selected));
        } else if (mounted && $kANDa_selected == 0 && $sarga_selected == 0) {
          // console.log('home');
          goto('/');
        }
      }
    })
  );
  onDestroy(() => {
    unsubscribers.forEach((unsub) => unsub());
  });

  // Language Typing for Schwa Deletion
  $: sanskrit_mode_texts = createQuery({
    queryKey: ['sanskrit_mode_texts'],
    enabled: browser && $editing_status_on && $trans_lang !== '--',
    queryFn: () =>
      Promise.all(
        ['राम्', 'राम'].map((text) => lipi_parivartak_async(text, BASE_SCRIPT, $trans_lang))
      ),
    placeholderData: ['राम्', 'राम']
  });
  onMount(() => {
    unsubscribers.push(
      sanskrit_mode_texts.subscribe(({ isFetching, isSuccess }) => {
        if (!$editing_status_on || isFetching || !isSuccess) return;
        const lng = LipiLekhikA.k.normalize($trans_lang);
        $sanskrit_mode = (LipiLekhikA.k.akSharAH as any)[lng].sa;
      })
    );
  });

  const get_page_info = () => {
    let title = 'श्रीमद्रामायणम्';
    let description = 'श्रीमद्रामायणस्य पठनम्';
    if ($kANDa_selected !== 0 && $sarga_selected !== 0) {
      const kANDa = rAmAyaNam_map[$kANDa_selected - 1];
      const sarga = kANDa.sarga_data[$sarga_selected - 1];
      title = `${sarga.name_devanagari} - ${kANDa.name_devanagari} (${sarga.index}-${kANDa.index}) | श्रीमद्रामायणम्`;
      description =
        `श्रीमद्रामायणस्य ${sarga.name_devanagari} - ${kANDa.name_devanagari} पठनम् | ` +
        `Read ${sarga.name_normal} - ${kANDa.name_normal} of Shri Ramayanam. ${sarga.index} - ${kANDa.index}`;
    } else if ($kANDa_selected !== 0 && $sarga_selected === 0) {
      const kANDa = rAmAyaNam_map[$kANDa_selected - 1];
      title = `${kANDa.name_devanagari} (${kANDa.index}) | श्रीमद्रामायणम्`;
      description =
        `श्रीमद्रामायणस्य ${kANDa.name_devanagari} पठनम् | ` +
        `Read ${kANDa.name_normal} of Shri Ramayanam. ${kANDa.index}`;
    }
    return {
      title,
      description
    };
  };
  let PAGE_INFO = get_page_info();
  $: {
    $kANDa_selected;
    $sarga_selected;
    PAGE_INFO = get_page_info();
  }
</script>

<MetaTags title={PAGE_INFO.title} description={PAGE_INFO.description} />
<div class="mt-4 space-y-4">
  <div class="flex justify-between">
    <label class="space-x-4">
      Script
      <Icon src={LanguageIcon} class="text-4xl" />
      <select
        class="select inline-block w-40"
        disabled={$viewing_script_mut.isPending}
        bind:value={$viewing_script_selection}
      >
        {#each SCRIPT_LIST as lang (lang)}
          <option value={lang}>{lang}</option>
        {/each}
      </select>
    </label>
    <User />
  </div>
  <!-- svelte-ignore a11y-label-has-associated-control -->
  <label class="space-x-4">
    <span class="font-bold">Select kANDa</span>
    <Select
      class={`${get_text_font_class($viewing_script)} select w-52`}
      zodType={z.coerce.number().int()}
      bind:value={$kANDa_selected}
      options={[{ value: 0, text: 'Select' }].concat(
        kANDa_names.map((name, index) => ({
          value: index + 1,
          text: `${index + 1} ${name}`
        }))
      )}
      disabled={$editing_status_on}
    />
  </label>
  {#if $kANDa_selected !== 0}
    <div class="space-x-8">
      <!-- svelte-ignore a11y-label-has-associated-control -->
      <label class="inline-block space-x-4">
        <span class="font-bold">Select Sarga</span>
        <Select
          class={`${get_text_font_class($viewing_script)} select w-52`}
          zodType={z.coerce.number().int()}
          bind:value={$sarga_selected}
          options={[{ value: 0, text: 'Select' }].concat(
            sarga_names.map((name, index) => ({
              value: index + 1,
              text: `${index + 1} ${name}`
            }))
          )}
          disabled={$editing_status_on}
        />
      </label>
      {#if $kANDa_selected !== 0 && $sarga_selected !== 0}
        {#await import('./display/SargaUtility.svelte') then SargaUtility}
          <SargaUtility.default />
        {/await}
      {/if}
    </div>
  {/if}
  {#if $kANDa_selected !== 0 && $sarga_selected !== 0}
    {@const kANDa = rAmAyaNam_map[$kANDa_selected - 1]}
    <div class="space-x-3">
      {#if $sarga_selected !== 1}
        <button
          on:click={() => ($sarga_selected -= 1)}
          in:scale
          out:slide
          disabled={$editing_status_on}
          class="btn rounded-lg bg-tertiary-700 px-2 py-1 font-bold text-white"
        >
          <Icon class="-mt-1 mr-1 text-xl" src={TiArrowBackOutline} />
          Previous
        </button>
      {/if}
      {#if $sarga_selected !== kANDa.sarga_data.length}
        <button
          on:click={() => ($sarga_selected += 1)}
          in:scale
          out:slide
          disabled={$editing_status_on}
          class="btn rounded-lg bg-tertiary-700 px-2 py-1 font-bold text-white"
        >
          Next
          <Icon class="-mt-1 ml-1 text-xl" src={TiArrowForwardOutline} />
        </button>
      {/if}
      {#if !($ai_tool_opened && $user_info && $user_info.user_type === 'admin')}
        {#if !$view_translation_status}
          <button
            on:click={() => {
              $view_translation_status = true;
            }}
            class="btn bg-primary-800 px-2 py-1 font-bold text-white dark:bg-primary-700"
            >View Translations</button
          >
        {:else}
          <label class="mr-3 inline-block space-x-4">
            Translation
            <Icon src={LanguageIcon} class="text-2xl" />
            <select
              disabled={$editing_status_on ||
                $trans_lang_mut.isPending ||
                $viewing_script_mut.isPending}
              class="select inline-block w-32 px-2 py-1"
              bind:value={$trans_lang_selection}
            >
              <option value="--">-- Select --</option>
              {#each LANG_LIST as lang (lang)}
                <option value={lang}>{lang}</option>
              {/each}
            </select>
          </label>
          {#if !$editing_status_on && $trans_lang !== '--' && !LOCALS_TRANS_LANGS.includes($trans_lang) && $user_allowed_langs.isSuccess && $user_info && (get_possibily_not_undefined($user_info).user_type === 'admin' || $user_allowed_langs.data.indexOf($trans_lang) !== -1)}
            <button
              on:click={() => ($editing_status_on = true)}
              class="btn my-1 rounded-lg bg-tertiary-700 px-2 py-1 font-bold text-white dark:bg-tertiary-600"
            >
              <Icon src={BiEdit} class="mr-1 text-2xl" />
              Edit
            </button>
          {/if}
        {/if}
      {/if}
    </div>
    {#if $editing_status_on && !($ai_tool_opened && $user_info && $user_info.user_type === 'admin')}
      <div class="flex space-x-4">
        <SlideToggle
          name="edit_lang"
          active="bg-primary-500"
          class="hover:text-gray-500 dark:hover:text-gray-400"
          bind:checked={$edit_language_typer_status}
          size="sm"
        >
          <Icon src={BsKeyboard} class="text-4xl" />
        </SlideToggle>
        {#if $edit_language_typer_status && $sanskrit_mode_texts.isSuccess && !$sanskrit_mode_texts.isFetching}
          <select
            transition:scale
            bind:value={$sanskrit_mode}
            class="select m-0 w-28 text-clip px-1 py-1 text-sm"
          >
            <option value={1}>rAm ➔ {$sanskrit_mode_texts.data[0]}</option>
            <option value={0}>rAm ➔ {$sanskrit_mode_texts.data[1]}</option>
          </select>
        {/if}
        <button
          class="btn rounded-md p-0 text-sm"
          title={'Language Typing Assistance'}
          on:click={() => ($typing_assistance_modal_opened = true)}
        >
          <Icon src={BiHelpCircle} class="mt-1 text-3xl text-sky-500 dark:text-sky-400" />
        </button>
      </div>
    {/if}
    {#if !$ai_tool_opened}
      <SargaDisplay />
    {:else if $user_info && $user_info.user_type === 'admin'}
      {#await import('./ai/AITools.svelte') then AITools}
        <AITools.default />
      {/await}
    {/if}
  {/if}
</div>

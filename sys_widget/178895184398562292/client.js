const EMAIL_SVG = `
<svg fill="#000000" height="32px" width="32px" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">
<path d="M58.0034485,8H5.9965506c-3.3136795,0-5.9999995,2.6862001-5.9999995,6v36c0,3.3137016,2.6863203,6,5.9999995,6
h52.006897c3.3137016,0,6-2.6862984,6-6V14C64.0034485,10.6862001,61.3171501,8,58.0034485,8z M62.0034485,49.1108017
L43.084549,30.1919994l18.9188995-12.0555992V49.1108017z M5.9965506,10h52.006897c2.2056007,0,4,1.7943001,4,4v1.7664003
L34.4677505,33.3134003c-1.4902,0.9492989-3.3935013,0.9199982-4.8495998-0.0703011L1.9965508,14.4694996V14
C1.9965508,11.7943001,3.7910507,10,5.9965506,10z M1.9965508,16.8852005L21.182251,29.9251003L1.9965508,49.1108017V16.8852005z
M58.0034485,54H5.9965506c-1.6473999,0-3.0638998-1.0021019-3.6760998-2.4278984l20.5199013-20.5200024l5.6547985,3.843401
c1.0859013,0.7383003,2.3418007,1.1083984,3.5995998,1.1083984c1.1953011,0,2.3925018-0.3339996,3.4463005-1.0048981
l5.8423996-3.7230015l20.2961006,20.2961025C61.0673485,52.9978981,59.6508713,54,58.0034485,54z"/>
</svg>`;
const OPEN_LINK_ICON_SVG = `
<svg xmlns="http://www.w3.org/2000/svg" x="0px" y="0px" width="20" height="20" viewBox="0 0 24 24">
<path d="M 5 3 C 3.9069372 3 3 3.9069372 3 5 L 3 19 C 3 20.093063 3.9069372 21 5 21 L 19 21 C 20.093063 21 21 20.093063 21 19 L 21 12 L 19 12 L 19 19 L 5 19 L 5 5 L 12 5 L 12 3 L 5 3 z M 14 3 L 14 5 L 17.585938 5 L 8.2929688 14.292969 L 9.7070312 15.707031 L 19 6.4140625 L 19 10 L 21 10 L 21 3 L 14 3 z"></path>
</svg>`;
const LOADER = `<div class="loader"><span></span></div>`;

let activityGroups = [];
let activityRecordsCount = 0;
let activityObject;
let activityRecordList;
let currentActivityRecordList;

(async () => {
  await init();

  s_widget_custom.downloadAttach = (attachId) => {
    const attachmentURL = `/attachments/download/${attachId}?access-token=${s_user.accessToken}`;
    window.location = `${API_BASE_URL}${attachmentURL}`;
  }

  s_widget_custom.showEmailBodyModal = async (emailBodyId) => {
    const emailsObject = activityObject.emails_object;
    await s_widget.setFieldValue('current_email_modal_title', emailsObject[emailBodyId].email_subject);
    await s_widget.setFieldValue('show_modal', true);
    await s_widget.setFieldValue('show_email_modal', true);
    const template = `
      <attachment
        tableName='sys_email' 
        recordId='${emailBodyId}'
        isReadOnly="true"
      ></attachment>
    `;
    Object.assign(document.querySelector('[data-test="modal-window"]').style, {
      maxWidth: '950px',
      zIndex: '30',
    });
    s_widget.addTemplate('email-attachments', template, '', 'inner');
    document.getElementById('email-body').insertAdjacentHTML('afterbegin', emailsObject[emailBodyId].email_body);
  }

  s_widget_custom.showMoreContent = (event, index) => {
    event.target.closest('.activity-item').hidden = true;
    const showMoreContentIndex = Math.ceil(index / 100) - 1;
    updateActivityFeedItems(index, `activity-feed-show-more-content-${showMoreContentIndex}`);
  }

  s_widget_custom.openEmailLink = (emailBodyId) => {
    s_go.open(`/record/sys_email/${emailBodyId}`, '_blank', () => { });
  }

  s_widget_custom.destroyModal = () => {
    s_widget.setFieldValue('show_modal', false);
    s_widget.setFieldValue('show_email_modal', false);
    s_widget.setFieldValue('show_comment_modal', false);
    s_widget.setFieldValue('show_comment_img_modal', false);
    s_widget.removeTemplate('email-attachments');
  }

  s_widget_custom.toggleActivityContentVisibility = () => {
    s_widget.setFieldValue('isActivityContentVisible', !s_widget.getFieldValue('isActivityContentVisible'));
    document.getElementById('activity-chevron').classList.toggle('activity-chevron-right');
  }


  s_widget_custom.commentChanges = () => {
    const isCommentFilled = !!s_widget.getFieldValue('comment').trim();

    s_widget.setFieldValue('isAddCommentButtonDisabled', !isCommentFilled);
  }

  s_widget_custom.addComment = async () => {
    document.getElementById('activity-feed').insertAdjacentHTML('afterbegin', LOADER);
    s_widget.setFieldValue('activity_records_count', activityObject.activity_records.length.toString());
    s_widget.setFieldValue('activity_object', JSON.stringify(activityObject));
    await updateServer('ADD_COMMENT');
    s_widget.setFieldValue('isAddCommentButtonDisabled', true);
    setGlabalVariables();
    filterActivities();
    updateActivityFeedItems();
    document.querySelector('.loader').remove();
  }

  s_widget_custom.filter = (activityType) => {
    const currentTab = document.getElementById(`tab-${activityType}`);
    if (currentTab.classList.contains('tab-active')) {
      return;
    }
    document.querySelectorAll('.activity-tab.tab-active').forEach((tab) => {
      tab.classList.remove('tab-active');
    });
    currentTab.classList.add('tab-active');
    if (activityType === 'work-notes' || activityType === 'additional-comments') {
      s_widget.setFieldValue('commentTypeOption', s_widget.getFieldValue('commentTypeOptions').find(({ database_value }) => database_value === activityType));
    }
    filterActivities(activityType);
    updateActivityFeedItems();
    document.getElementById('activity-feed').scrollTo({ top: 0, behavior: 'smooth' });
  }
})();

async function init() {
  const startTime = Date.now();

  toggleLoaderVisibility();

  if (s_form.getTableName() === 'itsm_infosys_task') {
    document.getElementById('activity-box').classList.add('m-w-100-important');
  }

  s_widget.setFieldValue('table_name', s_form.getTableName());
  s_widget.setFieldValue('record_id', s_form.getUniqueValue());

  await updateServer('INIT');

  s_widget.setFieldValue('isCommentHintVisible', s_widget.getFieldValue('isAdditionalCommentsAvailable') && s_form.getTableName() !== 'c_zapad_task');
  s_widget.setFieldValue('isCommentBlockVisible', s_widget.getFieldValue('commentTypeOptions').length !== 0);
  s_widget.setFieldValue('isWorkNotesTabVisible', s_widget.getFieldValue('isWorkNotesAvailable'));
  s_widget.setFieldValue('isAdditionalCommentsTabVisible', s_widget.getFieldValue('isAdditionalCommentsAvailable'));
  s_widget.setFieldValue('isDeadlineTabVisible', s_widget.getFieldValue('isDeadlineAvailable'));
  s_widget.setFieldValue('isActivityContentVisible', true);

  setGlabalVariables();
  filterActivities();
  updateActivityFeedItems();

  toggleLoaderVisibility();

  console.log(`Activity execution time: ${Date.now() - startTime} ms`);
}

async function updateServer(action) {
  s_widget.setFieldValue('action', action);
  await s_widget.serverUpdate();
  s_widget.setFieldValue('action', '');
}

function toggleLoaderVisibility() {
  s_widget.setFieldValue('isLoaderVisible', !s_widget.getFieldValue('isLoaderVisible'));
}

function setGlabalVariables() {
  activityObject = JSON.parse(s_widget.getFieldValue('activity_object'));
  currentActivityRecordList = activityObject.activity_records;
}

function filterActivities(activityType = null) {
  if (!activityType) {
    activityType = document.querySelector('.activity-tab.tab-active').id.replace(/^tab-/, '');
  }
  currentActivityRecordList = activityObject.activity_records;
  if (activityType !== 'all') {
    currentActivityRecordList = currentActivityRecordList.filter((record) => record.activity_type === activityType);
  } else {
    currentActivityRecordList = currentActivityRecordList.filter((record) => record.activity_type !== 'deadline');
  }
  s_widget.setFieldValue('activity_records_count', currentActivityRecordList.length.toString());
  activityGroups = [];
}

function updateActivityFeedItems(index = 0, showMoreContent = false) {
  activityRecordsCount = currentActivityRecordList.length;
  let template = '';
  for (const record of currentActivityRecordList.slice(index, index + 100)) {
    if (record.activity_type === 'deadline') {
      template += composeDeadlineTemplate(record);
    } else if (record.activity_type === 'history') {
      template += composeHistoryTemplate(record);
    } else if (record.activity_type === 'email') {
      template += composeEmailConversationTemplate(record);
    } else {
      template += composeCommentsTemplate(record);
    }
    index++;
  }
  if (index < activityRecordsCount) {
    template += composeShowMoreTemplate(index);
  }
  if (showMoreContent) {
    s_widget.addTemplate(showMoreContent, template, '', 'inner');
  } else {
    s_widget.removeTemplate('activity-feed');
    for (let i = 0; i < Math.floor(activityRecordsCount / 100); i++) {
      template += `<div id="activity-feed-show-more-content-${i}"></div>`;
    }
    s_widget.addTemplate('activity-feed', template, '', 'inner');
    document.querySelectorAll('[data-type="show-more"]').forEach((element) => {
      element.hidden = false;
    });

    // Привязываем обработчики событий к изображениям из комментариев
    const images = document.querySelectorAll('.comment-message img');
    images.forEach((image) => {
      image.addEventListener('click', openImageModal);
    });
  }
}

function composeActivityGroupTemplate(activityDateTime) {
  let date;
  if (!activityDateTime.match(/\d{4}-\d{2}-\d{2}/)) {
    date = activityDateTime.split(' ')[0];
  } else {
    date = new Date(activityDateTime).toISOString().split('T')[0];
  }
  if (activityGroups.indexOf(date) !== -1) {
    return '';
  }
  activityGroups.push(date);
  return `
    <div id="${date}" class="activity-group">
      <span>${date}</span>
    </div>
  `.trim();
}

function composeActivityItemHeadTemplate(data) {
  const type = data.activity_type;

  return `
    <div class="activity-item-head">
      <div class="activity-item-user">
        <div>${getAvatarTemplate(data)}</div>
        <div class="activity-content">
          <div class="user-title">${data.sys_created_by_display}</div>
          <div class="activity-date">${data.sys_created_at_display}</div>${data.target_item_link ? `&nbsp${data.target_item_link}` : ''}
        </div>
      </div>
      <div class="activity-content-icon"
        <button buttonType="icon" hint="${getHint(type)}" event-click="s_widget_custom.filter('${type}')">${getEmoji(type)}</button>
      </div>
    </div>
  `.trim();
}

function getAvatarTemplate(data) {
  if (data.avatar) {
    return `<img alt="" class="activity-avatar" src="${data.avatar}">`;
  }

  return `
    <svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" fill="none" viewBox="0 0 40 40">
      <path fill="#E1E1E1" d="M20 0C8.96 0 0 8.96 0 20s8.96 20 20 20 20-8.96 20-20S31.04 0 20 0zm0 6c3.32 0 6 2.68 6 6s-2.68 6-6 6-6-2.68-6-6 2.68-6 6-6zm0 28.4c-5 0-9.42-2.56-12-6.44.06-3.98 8-6.16 12-6.16 3.98 0 11.94 2.18 12 6.16-2.58 3.88-7 6.44-12 6.44z"></path>
    </svg>
  `;
}

function getHint(type) {
  if (type === 'history' || type === 'deadline') {
    return '{data.translations.show_changes_history}';
  }

  if (type === 'additional-comments') {
    return '{data.translations.show_additional_info}';
  }

  if (type === 'work-notes') {
    return '{data.translations.show_work_notes}';
  }

  if (type === 'email') {
    return '{data.translations.show_email_conversation}';
  }

  return '';
}

function getEmoji(type) {
  if (type === 'history') {
    return '<span class="emoji">📖</span>';
  }

  if (type === 'deadline') {
    return '<span class="emoji">📆</span>';
  }

  if (type === 'additional-comments') {
    return '<span class="emoji">💬</span>';
  }

  if (type === 'work-notes') {
    return '<span class="emoji">📝</span>';
  }

  if (type === 'email') {
    return '<span class="emoji">📫</span>';
  }

  return '';
}

function composeDeadlineTemplate(data) {
  return `
    ${composeActivityGroupTemplate(data.sys_created_at_display)}
    <div class="activity-item">
      ${composeActivityItemHeadTemplate(data)}
      ${composeHistoryItemListTemplate(data.content)}
    </div>
  `.trim();
}

function composeHistoryTemplate(data) {
  return `
    ${composeActivityGroupTemplate(data.sys_created_at_display)}
    <div class="activity-item">
      ${composeActivityItemHeadTemplate(data)}
      ${composeHistoryItemListTemplate(data.content)}
    </div>
  `.trim();
}

function composeHistoryItemListTemplate(itemList) {
  return itemList
    .map((item) => composeHistoryItemTemplate(item))
    .join('')
    .trim();
}

function composeHistoryItemTemplate(item) {
  const title = item.display_title;
  const newValue = item.new_display_value;
  const oldValue = item.old_display_value;

  return `
    <div class="activity-history">
      <div class="history-item-new">
        <div class="item-new-title">${title}</div>
        <div class="item-new-text">${newValue}</div>
      </div>
      <div class="history-item-old">
        <div class="item-old-title">${title}</div>
        <div class="item-old-text">${oldValue}</div>
      </div>
    </div>
  `.trim();
}

function composeEmailConversationTemplate(emailData) {
  const type = emailData.activity_type;
  const emailId = emailData.sys_id;

  return `
    ${composeActivityGroupTemplate(emailData.sys_created_at_display)}
    <div class="email-item">
      <div class="email-icon">
        <span>${EMAIL_SVG}</span>
        <span id="email-item-attachment-count">${countEmailAttachments(emailData.attachments)}</span>
      </div>
      <div class="email-container">
        <div class="email-item-semi-header">
          <div><span class="user-title">От:</span> ${emailData.from}</div>
          <div class="activity-content-icon-email">
            <button buttonType="icon" hint="${getHint(type)}" event-click="s_widget_custom.filter('${type}')">${getEmoji(type)}</button>
          </div>
        </div>
        <div><span class="user-title">Кому:</span> ${emailData.to}</div>
        <div><span class="user-title">Копия:</span> ${emailData.carbon_copy}</div>
        <div><span class="user-title">Дата:</span> ${emailData.sys_created_at_display}</div>
        <div><span class="user-title">Тема:</span> ${emailData.subject}</div>
        <div id="${emailId}" class="show-email-button">
          <button event-click="s_widget_custom.showEmailBodyModal('${emailId}')">Показать письмо</button>
          <button class="show-email-link" event-click="s_widget_custom.openEmailLink('${emailId}')" hint="Открыть ориг. письмо в новой вкладке">${OPEN_LINK_ICON_SVG}</button>
        </div>
      </div>
    </div>
  `.trim();
}

function composeCommentsTemplate(data) {
  return `
    ${composeActivityGroupTemplate(data.sys_created_at_display)}
    <div class="activity-item">
      ${composeActivityItemHeadTemplate(data)}
      <div class="activity-info">
        <div class="comment-message ${data.activity_type === 'additional-comments' ? 'additional-comment-st' : 'work-notes-st'}">${data.content.replace(/\n/g, '<br/>')}</div>
      </div>
    </div>
  `.trim();
}

function composeShowMoreTemplate(index) {
  return `
    <div class="activity-item show-more" data-type="show-more">
      <div class="show-more-content" event-click="s_widget_custom.showMoreContent(event, ${index})">
        <span>Показать больше</span>
      </div>
    </div>
  `.trim();
}

function countEmailAttachments(amount) {
  if (amount && amount > 0) {
    return `<span class="attachment-count">${amount}</span>`;
  } else return '';
}

// Функция для открытия изображения в модальном окне
async function openImageModal(event) {
  await s_widget.setFieldValue('show_comment_modal', true);
  await s_widget.setFieldValue('show_comment_img_modal', true);
  Object.assign(document.querySelector('[data-test="modal-window"]').style, {
    maxWidth: '950px',
    zIndex: '30',
  });
  document.getElementById('comment-body').insertAdjacentHTML('afterbegin', `<img src ="${event.target.src}" alt="no"></img>`);
}

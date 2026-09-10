const emailIdList = [];
let emailsObject = {};
const userDisplayNameObject = {};
let activityRecordList = [];
let activityTargetItemObject = {};
let filterTypeList = [];
const userAvatars = {};
const selectedAttributes = {
  activty_type: ['sys_id'],
  db_column: ['sys_id', 'title', 'column_type_id'],
  task: ['sys_id', 'number'],
  activity_feed_item: ['sys_id', 'type_id', 'content', 'table_id', 'record_id', 'sys_created_at', 'sys_created_by'],
  email: [
    'sys_id',
    'body_html',
    'body_text',
    'created_on_server_at',
    'sys_created_at',
    'from',
    'to',
    'carbon_copy',
    'subject',
    'direction',
    'sys_created_by',
    'c_attachments_amount',
  ],
  employee: ['sys_id', 'frist_name', 'last_name', 'username'],
  choice: ['sys_id', 'title'],
};

let workNotes = 'work_notes';
let additionalComments = 'additional_comments';
let emailConversation = 'email_conversation';

(() => {
  const tableName = input.table_name;
  const recordId = input.record_id;
  if (!tableName || !recordId) {
    return;
  }

  const record = new SimpleRecord(tableName);
  record.get(recordId);
  if (!record.sys_id) {
    return;
  }

  if (input.action === 'INIT') {
    setTranslations();
    setJournalInputColumns();
    setCommentTypeOptions(record);
    filterActivityTargetRecords(record, tableName, recordId);
    getActivitiesData();
  }

  if (input.action === 'ADD_COMMENT') {
    data.comment = '';
    data.duration = '';

    const { database_value: commentType } = input.commentTypeOption;
    const comment = getComment(input.comment, input.duration, task.getDisplayValue('c_trz_type'));

    if (commentType === 'work-notes') {
      record[workNotes] = comment;
    }

    if (commentType === 'additional-comments') {
      record[additionalComments] = comment;
    }

    record.update();

    setTimeSpent();

    getActivitiesData();
  }
})();

function setTranslations() {
  const message = new SimpleMessage();
  data.translations = {
    activity_feed_title: message.getMessage('Activity Feed', 'app'),
    additional_comments: message.getMessage('Additional info', 'activity_feed'),
    all_activity_feed_items: message.getMessage('All activity feed items', 'activity_feed'),
    changes_history: message.getMessage('Changes history', 'activity_feed'),
    deadline: message.getMessage('Deadline', 'activity_feed'),
    email_conversation: message.getMessage('Email conversation', 'activity_feed'),
    enter_your_message: message.getMessage('Enter your message', 'app'),
    show_additional_info: message.getMessage('Show additional info', 'activity_feed'),
    show_changes_history: message.getMessage('Show changes history', 'activity_feed'),
    show_email_conversation: message.getMessage('Show email conversation', 'activity_feed'),
    show_work_notes: message.getMessage('Show work notes', 'activity_feed'),
    work_notes: message.getMessage('Work notes', 'activity_feed'),
  };
}

function setJournalInputColumns() {
  if (input.table_name == 'c_presale_task' || input.table_name == 'c_presale_order') {
    workNotes = 'z_work_notes';
    additionalComments = 'z_additional_comments';
    emailConversation = 'z_email_conversation';
  }

  if (input.table_name == 'itsm_infosys_order') {
    emailConversation = 'c_email_conversation';
  }
}

function setCommentTypeOptions(record) {
  const attributes = record.getAttributes();
  const options = [];

  if (attributes.hasOwnProperty(workNotes) && (ss.hasRole('ITSM_agent') || ss.hasRole('service_manager'))) {
    const option = {
      database_value: 'work-notes',
      display_value: data.translations.work_notes,
    };

    options.push(option);

    data.commentTypeOption = data.commentTypeOption || option;
    data.isWorkNotesAvailable = true;
  }

  if (attributes.hasOwnProperty(additionalComments)) {
    const option = {
      database_value: 'additional-comments',
      display_value: data.translations.additional_comments,
    };

    options.push(option);

    data.commentTypeOption = data.commentTypeOption || option;
    data.isAdditionalCommentsAvailable = true;
  }

  data.commentTypeOptions = options;
}

function getComment(comment, duration, type) {
  ss.importIncludeScript('createWorkNotesMessage');
  return workNotesMessage('Комментарий к трудозатратам', comment, duration, type);
}

function setTimeSpent() {
  ss.importIncludeScript('WTMUtils');
  const wtm = new WTMUtils(ss.getUserID(), input.record_id, input.table_name);
  wtm.setTimeSpent(input.duration, input.comment, new SimpleDateTime().getLocalDate());
}

function filterActivityTargetRecords(task, tableName, recordId) {
  filterTypeList = [
    `${additionalComments}.${tableName}`,
    `${workNotes}.${tableName}`,
    `${emailConversation}.${tableName}`,
    'history',
  ];

  activityTargetItemObject[recordId] = '';
  if (tableName === 'itsm_infosys_task') {
    const childTask = new SimpleRecord('task');
    childTask.selectAttributes(selectedAttributes.task);
    childTask.addQuery('parent_id', recordId);
    childTask.query();
    while (childTask.next()) {
      const childTaskId = childTask.sys_id;
      const childTaskTableName = childTask.getTableName();
      const childTaskNumber = childTask.number;
      const childTaskLink = childTask.canRead()
        ? `<a href="/record/${childTaskTableName}/${childTaskId}" target="_blank">DISPLAY</a>`
        : 'DISPLAY';
      if (childTaskTableName === 'itsm_infosys_rfc') {
        filterTypeList.push(`${workNotes}.${childTaskTableName}`);
        activityTargetItemObject[childTaskId] = childTaskLink.replace('DISPLAY', `RFC ${childTaskNumber}`);
      } else if (childTaskTableName === 'itsm_infosys_order') {
        filterTypeList.push(`${workNotes}.${childTaskTableName}`);
        activityTargetItemObject[childTaskId] = childTaskLink.replace('DISPLAY', childTaskNumber);
      } else if (task.c_complex_task && childTaskTableName === 'itsm_infosys_task') {
        activityTargetItemObject[childTaskId] = childTaskLink.replace('DISPLAY', childTaskNumber);
      }
    }
  }
}

function getActivitiesData() {
  activityRecordList = [];
  const activityObject = JSON.parse(input.activity_object || '{}');
  let existingRecords = activityObject.activity_records || [];

  let lastFoundActivityRecordId = activityObject.last_found_activity_record_id || '1';
  emailsObject = activityObject.emails_object || {};
  filterTypeList = activityObject.filter_type_list || filterTypeList;
  activityTargetItemObject = activityObject.activity_target_item_object || activityTargetItemObject;

  let queryString =
    '(' +
    filterTypeList.reduce((acc, current, index) => {
      if (index === filterTypeList.length - 1) {
        return acc + current;
      } else {
        return acc + current + '^ORtype_id.name=';
      }
    }, 'type_id.name=') +
    ')';
  queryString += '^record_idIN' + Object.keys(activityTargetItemObject).join('@');
  queryString += `^sys_id>${lastFoundActivityRecordId}`;
  queryString = `(${queryString})`;
  const activity = new SimpleRecord('sys_activity_feed_item');
  activity.selectAttributes(selectedAttributes.activity_feed_item);
  activity.addEncodedQuery(queryString);
  activity.orderByDesc('sys_id');
  activity.setLimit(10000);
  activity.query();
  if (activity.getRowCount() === 0) {
    activityRecordList = existingRecords;
    data.activity_records_count = activityRecordList.length.toString();
    data.activity_object = JSON.stringify({
      last_found_activity_record_id: lastFoundActivityRecordId,
      activity_records: activityRecordList,
      emails_object: emailsObject,
      filter_type_list: filterTypeList,
      activity_target_item_object: activityTargetItemObject,
    });
    return;
  }

  const regexAdditionalComments = new RegExp('^' + additionalComments + '\\.');
  const regexWorkNotess = new RegExp('^' + workNotes + '\\.');
  const regexEmailConversation = new RegExp('^' + emailConversation + '\\.');

  const isWorkNotesAvailable = data.isWorkNotesAvailable || input.isWorkNotesAvailable;
  const isAdditionalCommentsAvailable = data.isAdditionalCommentsAvailable || input.isAdditionalCommentsAvailable;

  while (activity.next()) {
    lastFoundActivityRecordId = activity.sys_id.toString();
    const activityTypeName = activity.type_id.name;
    let activityContent = activity.content;
    if (activityTypeName.match(regexEmailConversation)) {
      collectEmailRecordIds(activity, activityContent);
      continue;
    }
    const activityTargetItemLink = activityTargetItemObject[activity.record_id.toString()];
    if (activityTypeName === 'history') {
      activityContent = activityContent.replace(/(column_id"|db_value"):\s*(-?\d+),/g, '$1: "$2",');
      const filteredHistoryFields = filterHistoryFields(activityContent, activity.table_id.toString());
      if (filteredHistoryFields.length === 0) {
        continue;
      }
      addActivityRecord(activity, 'history', filteredHistoryFields, activityTargetItemLink);
    } else if (activityTypeName.match(regexWorkNotess) && isWorkNotesAvailable) {
      activityContent = JSON.parse(activityContent);
      const content = activityContent.message.display_value || activityContent.message;
      addActivityRecord(activity, 'work-notes', content, activityTargetItemLink);
    } else if (activityTypeName.match(regexAdditionalComments) && isAdditionalCommentsAvailable) {
      activityContent = JSON.parse(activityContent);
      const content = activityContent.message.display_value || activityContent.message;
      addActivityRecord(activity, 'additional-comments', content, activityTargetItemLink);
    }
  }

  addDeadlineData();
  getEmailConversationData();

  activityRecordList = activityRecordList.concat(existingRecords);

  activityRecordList = activityRecordList.filter(
    (item, index, self) => index === self.findIndex((t) => t.sys_id === item.sys_id),
  );

  data.activity_records_count = activityRecordList.length.toString();
  data.activity_object = JSON.stringify({
    last_found_activity_record_id: lastFoundActivityRecordId,
    activity_records: activityRecordList,
    emails_object: emailsObject,
    filter_type_list: filterTypeList,
    activity_target_item_object: activityTargetItemObject,
  });
}

function collectEmailRecordIds(activity, content) {
  let emailMeta;
  try {
    emailMeta = JSON.parse(JSON.parse(content).message);
  } catch {
    emailMeta = '';
  }
  if (!emailMeta || !emailMeta.email_sys_id) {
    return;
  }
  emailIdList.push(emailMeta.email_sys_id);
}

function getEmailConversationData() {
  const makeDisplayName = (email) => {
    let displayName = userDisplayNameObject[email];
    if (displayName) {
      return displayName;
    }
    const employee = new SimpleRecord('employee');
    employee.selectAttributes(selectedAttributes.employee);
    employee.get('email', email);
    displayName = employee.first_name
      ? `${employee.first_name} ${employee.last_name} (${employee.username})`
      : email.replace('<', '(').replace('>', ')');
    userDisplayNameObject[email] = displayName;
    return displayName;
  };

  const queryString = 'sys_idIN' + emailIdList.join('@');

  const emailRecord = new SimpleRecord('sys_email');
  emailRecord.selectAttributes(selectedAttributes.email);
  emailRecord.addEncodedQuery(queryString);
  emailRecord.query();

  while (emailRecord.next()) {
    const emailId = emailRecord.sys_id.toString();
    const integrationBmcId = ss.getProperty('jet.integration.bmc.user_id'); // IntegrationBMC user
    const createdByIntegrationBmc = emailRecord.sys_created_by;
    const plainText = emailRecord.body_text;
    let emailBody;
    const htmlBody = emailRecord.body_html;
    if ((createdByIntegrationBmc == integrationBmcId && plainText !== '') || htmlBody == '') {
      emailBody = `<pre>${emailRecord.body_text}</pre>`;
    } else {
      emailBody = emailRecord.body_html.replace(/'/g, '&#39;').replace('<!DOCTYPE html>', '<!DOCTYPE html "">'); // DOCTYPE replace - workaround INC0008366
    }
    const emailSubject = escapeSpecialSymbols(emailRecord.subject);
    const emailAttachmentsAamount = emailRecord.c_attachments_amount;
    emailsObject[emailId] = {
      email_body: emailBody,
      email_subject: emailSubject,
    };

    activityRecordList.push({
      activity_type: 'email',
      from: makeDisplayName(emailRecord.from),
      to: makeDisplayName(emailRecord.to),
      carbon_copy: makeDisplayName(emailRecord.carbon_copy),
      sys_created_at_display: emailRecord.getDisplayValue('created_on_server_at') || emailRecord.getDisplayValue('sys_created_at'),
      subject: emailSubject,
      sys_id: emailId,
      attachments: emailAttachmentsAamount,
    });
  }
}

function getCurrentLangChoiceFieldDisplayValue(tableId, columnId, dbValue, displayValue) {
  const userLanguage = new SimpleUser().getContext().language_id.language;

  if (displayValue === '--None--' && userLanguage === 'ru') {
    return '--Нет--';
  } else if (displayValue === '--Нет--' && userLanguage === 'en') {
    return '--None--';
  }
  const queryString = `table_id=${tableId}^column_id=${columnId}^value=${dbValue}^language=${userLanguage}`;
  const choice = new SimpleRecord('sys_choice');
  choice.setLimit(1);
  choice.selectAttributes(selectedAttributes.choice);
  choice.addEncodedQuery(queryString);
  choice.query();

  if (choice.next()) {
    return choice.title;
  } else {
    return displayValue;
  }
}

function translateBoolValue(displayValue) {
  const userLanguage = new SimpleUser().getContext().language_id.language;

  displayValue = displayValue.toString().toLowerCase();
  if (userLanguage === 'ru') {
    if (displayValue === 'false' || displayValue === 'no') {
      displayValue = 'Нет';
    } else if (displayValue === 'true' || displayValue === 'yes') {
      displayValue = 'Да';
    }
  } else if (userLanguage === 'en') {
    if (displayValue === 'нет' || displayValue === 'false') {
      displayValue = 'No';
    } else if (displayValue === 'да' || displayValue === 'true') {
      displayValue = 'Yes';
    }
  }
  return displayValue;
}

function filterHistoryFields(content, tableId) {
  const historyItems = JSON.parse(content).history_items;
  const availableColumns = getAvailableColumns();

  return historyItems.filter((item) => {
    const column = availableColumns[item.column_id];

    if (!column) {
      return false;
    }

    item.display_title = column.title;

    if (!item.new_display_value) {
      item.new_display_value = '';
    }

    if (!item.old_display_value) {
      item.old_display_value = '';
    }

    const columnTypeId = column.typeId;
    const newValue = item.new_display_value;
    const oldValue = item.old_display_value;

    if (columnTypeId !== '9' && newValue) {
      item.new_display_value = newValue.replace(/</g, '&lt;').replace(/>/g, '&gt;').trim();
    }

    if (columnTypeId !== '9' && oldValue) {
      item.old_display_value = oldValue.replace(/</g, '&lt;').replace(/>/g, '&gt;').trim();
    }

    if (columnTypeId === '3' && newValue) {
      item.new_display_value = new SimpleDateTime(newValue).getDisplayValue();
    }

    if (columnTypeId === '3' && oldValue) {
      item.old_display_value = new SimpleDateTime(oldValue).getDisplayValue();
    }

    if (columnTypeId === '9' && newValue) {
      item.new_display_value = translateBoolValue(newValue);
    }

    if (columnTypeId === '9' && oldValue) {
      item.old_display_value = translateBoolValue(oldValue);
    }

    if (columnTypeId === '17') {
      item.new_display_value = getCurrentLangChoiceFieldDisplayValue(
        tableId,
        item.column_id,
        item.new_db_value,
        newValue,
      );
      item.old_display_value = getCurrentLangChoiceFieldDisplayValue(
        tableId,
        item.column_id,
        item.old_db_value,
        oldValue,
      );
    }

    return true;
  });
}

function getAvailableColumns() {
  const availableColumns = {};
  const availableColumnIds = getAvailableColumnIds();

  const column = new SimpleRecord('sys_db_column');
  column.addEncodedQuery(`sys_idIN${availableColumnIds.join('@')}`);
  column.selectAttributes(selectedAttributes.db_column);
  column.setLimit(availableColumnIds.length);
  column.query();

  while (column.next()) {
    availableColumns[column.sys_id.toString()] = {
      title: column.title,
      typeId: column.column_type_id.toString(),
    };
  }

  return availableColumns;
}

function getAvailableColumnIds() {
  return ss
    .getProperty(`${getPropertyPrefix()}.activity_column_filter_ids`)
    .replace(/\s+/g, '')
    .split(',')
    .filter(id => id);
}

function getPropertyPrefix() {
  if (input.table_name === 'c_presale_task' || input.table_name === 'c_presale_order') {
    return 'presale';
  }

  return 'dvt';
}

function addDeadlineData() {
  const history = new SimpleRecord('sys_history');
  history.addQuery('table_name', input.table_name);
  history.addQuery('record_id', input.record_id);
  history.addQuery('field_name', 'planned_end_datetime');
  history.query();

  while (history.next()) {
    const content = [{
      display_title: 'Плановая дата/время окончания',
      new_display_value: history.new_value ? new SimpleDateTime(history.new_value).getDisplayValue() : history.new_value,
      old_display_value: history.old_value ? new SimpleDateTime(history.old_value).getDisplayValue() : history.old_value,
    }];

    addActivityRecord(history, 'deadline', content, '');
  }

  data.isDeadlineAvailable = true;
}

function addActivityRecord(record, type, content, activityTargetItemLink) {
  activityRecordList.push({
    activity_type: type,
    content: content,
    sys_created_at_display: record.getDisplayValue('sys_created_at'),
    sys_created_by_display: record.sys_created_by.display_name,
    avatar: getAvatarSrc(record.sys_created_by),
    target_item_link: activityTargetItemLink,
    sys_id: record.sys_id.toString(),
  });
}

function getAvatarSrc(user) {
  const photoId = user.getValue('photo_id');
  if (!photoId) {
    return '';
  }
  if (photoId && !userAvatars[photoId]) {
    userAvatars[photoId] = new SimpleImage().getImageUrlById(photoId);
  }
  return userAvatars[photoId];
}

function escapeSpecialSymbols(text) {
  if (/<img\b[^>]*>/i.test(text)) {
    return text;
  }

  const map = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;',
  };

  return text.replace(/[&<>"']/g, symbol => map[symbol]);
}

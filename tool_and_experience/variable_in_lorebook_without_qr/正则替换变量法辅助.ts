const variable_regex = /@(.*?)@?=(?:.*?⇒)?'?(.*?)'?((@$)|(?=@))/gm;

/**
 * 解析文本中的所有 `"@变量=值@"` 和 `"@变量=旧值⇒新值@"`, 转换为键值对对象
 *
 * @param text 要解析的文本
 * @returns 解析得到的键值对对象
 */
function parseVariables(text: string): Record<string, any> {
  return _.merge({}, ...[...text.matchAll(variable_regex)].map(match => ({ [match[1]]: match[2] })));
}

/**
 * 在最后一条 ai 消息附加 `@变量=值@` 从而更新变量
 *
 * @param data 要更新的变量和值
 *
 * @example
 * await updateLastVariables({
 *   '变量.络络.亲密度': 60,
 *   '变量.络络.下次响应界面选择判断': 2,
 * });
 */
async function updateLastVariables(data: Record<string, any>) {
  const last_char_message_id = await getChatMessages('0-{{lastMessageId}}', { role: 'assistant' }).then(messages => {
    return (messages.at(-1) as ChatMessage).message_id;
  });
  await updateVariablesAt(last_char_message_id, data);
}

/**
 * 在第 `message_id` 楼消息附加 `@变量=值@` 从而更新变量
 *
 * @param message_id 消息楼层号, 必须确保是 ai 消息才能正确更新
 * @param data 要更新的变量和值
 *
 * @example
 * await updateVariablesAt(0, {
 *   '变量.络络.亲密度': 60,
 *   '变量.络络.下次响应界面选择判断': 2,
 * });
 */
async function updateVariablesAt(message_id: number, data: Record<string, any>) {
  const messages = await getChatMessages(message_id, { role: 'assistant' });
  if (messages.length <= 0) {
    return;
  }

  const message = messages[0].message;
  await setChatMessage(
    {
      message: message + Object.entries(data).map(([key, value]) => `\n@${key}=${value}@`),
    },
    message_id,
    { refresh: 'none' },
  );
}

$(() => {
  // 其他地方的代码可使用 `eventEmit('在最新楼层更新变量', {变量1: 值, 变量2: 值})` 来更新变量
  // 快速回复中可使用 `/event-emit event=在最新楼层更新变量 data={"变量.好感度1": 5, "变量.好感度2": 10}` 来更新变量并发送新消息
  eventOn('在最新楼层更新变量', updateLastVariables);

  // 其他地方的代码可使用 `eventEmit('更新变量并发送新的玩家输入', {变量1: 值, 变量2: 值}, "玩家输入")` 来更新变量并发送新消息
  // 快速回复中可使用 `/event-emit event=更新变量并发送新的玩家输入 data={"变量.好感度1": 5, "变量.好感度2": 10} data="玩家输入"` 来更新变量并发送新消息
  eventOn('更新变量并发送新的玩家输入', async (data: Record<string, any>, text: string) => {
    await updateLastVariables(data);
    triggerSlash(`/send ${text} || /trigger`);
  });

  // 其他地方的代码可使用 `eventEmit('检测输入中的变量更新并发送新的玩家输入', "@变量1=值@@变量2=值@玩家输入")` 来更新变量并发送新消息
  // 快速回复中可使用 `/event-emit event=检测输入中的变量更新并发送新的玩家输入 "@变量1=值@@变量2=值data="玩家输入"` 来更新变量并发送新消息
  eventOn('检测输入中的变量更新进行更新并发送新的玩家输入', async (text: string) => {
    await updateLastVariables(parseVariables(text));
    triggerSlash(`/send ${text.replaceAll(variable_regex, '').replace('^@', '').trim()} || /trigger`);
  });
});

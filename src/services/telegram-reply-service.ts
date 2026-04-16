import type { TelegramOutboundMessage } from '../adapters/telegram/outbound-schema.js';
import type {
  NewOpportunityDraftPayload,
  OpportunityDraftFieldKey,
  OpportunityDraftPayload,
  UpdateOpportunityDraftPayload
} from '../domain/opportunity-draft.js';
import { deriveMissingRequiredUpdateDraftFields as deriveMissingUpdateFields } from '../domain/opportunity-draft.js';
import type { OpenOpportunityListItem } from '../repositories/opportunity-repository.js';
import type { ProcessWebhookOutcome } from './process-webhook-service.js';

export function renderProcessWebhookReplies(values: {
  outcome: ProcessWebhookOutcome;
  chatId: string | null;
  replyToMessageId: number | null;
  draftPayload?: OpportunityDraftPayload | null;
  ownerName?: string | null;
  opportunityCreated?: { opportunityId: string } | null;
  opportunityUpdated?: { opportunityId: string } | null;
  openDeals?: OpenOpportunityListItem[];
}): TelegramOutboundMessage[] {
  if (!values.chatId) {
    return [];
  }

  const rendered = renderReply(values);

  if (!rendered) {
    return [];
  }

  const message: TelegramOutboundMessage = {
    chatId: values.chatId,
    text: rendered.text
  };

  if (values.replyToMessageId !== null) {
    message.replyToMessageId = values.replyToMessageId;
  }

  if (rendered.inlineKeyboard) {
    message.inlineKeyboard = rendered.inlineKeyboard;
  }

  return [message];
}

function renderReply(values: {
  outcome: ProcessWebhookOutcome;
  draftPayload?: OpportunityDraftPayload | null;
  ownerName?: string | null;
  opportunityCreated?: { opportunityId: string } | null;
  opportunityUpdated?: { opportunityId: string } | null;
  openDeals?: OpenOpportunityListItem[];
}): { text: string; inlineKeyboard?: TelegramOutboundMessage['inlineKeyboard'] } | null {
  switch (values.outcome) {
    case 'ignored_missing_user':
      return null;
    case 'ignored_unknown_user':
      return {
        text: 'บัญชี Telegram นี้ยังไม่ได้รับสิทธิ์ใช้งานระบบ\nThis Telegram account is not enabled for this bot yet. Please contact the admin.'
      };
    case 'ignored_non_text':
      return {
        text: 'กรุณาส่งข้อความตัวอักษรเพื่อเริ่มรายงานหรืออัปเดตดีล\nPlease send text to start a report or update a deal.'
      };
    case 'help_requested':
      return {
        text: [
          'คำสั่งที่ใช้ได้ / Available commands',
          '/help',
          '/cancel',
          '/mydeals',
          '',
          'ส่งข้อความดีลใหม่หรืออัปเดตเป็นข้อความอิสระได้เลย',
          'Send a free-text deal update or new report to start.'
        ].join('\n')
      };
    case 'my_deals_listed':
      return renderMyDeals(values.openDeals ?? []);
    case 'active_draft_exists':
      return {
        text: 'มี draft ที่กำลังทำอยู่แล้ว กรุณา /cancel ก่อนเริ่มงานใหม่\nThere is already an active draft. Please /cancel it before starting another action.'
      };
    case 'multiple_opportunities_detected':
      return {
        text: [
          'พบว่าข้อความนี้มีมากกว่าหนึ่ง opportunity',
          'One message can only create one opportunity.',
          '',
          'กรุณาแยกส่งทีละดีล / Please split and send one deal at a time.'
        ].join('\n')
      };
    case 'draft_cancelled':
      return {
        text: 'ยกเลิก draft ปัจจุบันแล้ว\nThe current draft has been cancelled.'
      };
    case 'no_active_draft_to_cancel':
      return {
        text: 'ไม่มี draft ที่กำลังทำอยู่\nThere is no active draft to cancel.'
      };
    case 'callback_ignored':
      return {
        text: 'ไม่พบ draft ที่กำลังทำอยู่สำหรับ action นี้\nNo active draft was found for that action.'
      };
    case 'callback_recorded':
      return {
        text: 'รับ action แล้ว และอัปเดต draft ให้แล้ว\nAction received and the current draft was updated.'
      };
    case 'update_draft_started':
    case 'update_draft_message_recorded':
      return renderUpdateDraftInProgress(values.draftPayload);
    case 'update_draft_ready_for_confirmation':
      return renderUpdateDraftReadyForConfirmation(values.draftPayload);
    case 'opportunity_updated':
      return renderOpportunityUpdated(values);
    case 'draft_started':
    case 'draft_message_recorded':
    case 'draft_needs_more_fields':
      return renderDraftNeedsMoreFields(asNewDraftPayload(values.draftPayload), values.ownerName);
    case 'draft_ready_for_confirmation':
      return renderDraftReadyForConfirmation(asNewDraftPayload(values.draftPayload), values.ownerName);
    case 'opportunity_created':
      return renderOpportunityCreated(values);
    default:
      return null;
  }
}

function renderDraftNeedsMoreFields(
  draftPayload: NewOpportunityDraftPayload | null,
  ownerName: string | null | undefined
): { text: string; inlineKeyboard?: TelegramOutboundMessage['inlineKeyboard'] } {
  if (!draftPayload) {
    return {
      text: 'ได้รับข้อความแล้ว แต่ draft ยังไม่พร้อม\nMessage received, but the draft is not ready yet.'
    };
  }

  const missing = draftPayload.missing_required as OpportunityDraftFieldKey[];

  return {
    text: [
      'ข้อมูลยังไม่ครบ / Need a few more details',
      '',
      renderNewDraftSummary(draftPayload, ownerName),
      '',
      'Missing required:',
      ...missing.map((field) => `- ${labelForDraftField(field)}`),
      '',
      'ส่งข้อความเพิ่มในรูปแบบ field: value ได้เลย',
      'Send more details in `field: value` form.'
    ].join('\n'),
    inlineKeyboard: [[{ text: 'Cancel Draft', callback_data: 'draft:cancel' }]]
  };
}

function renderDraftReadyForConfirmation(
  draftPayload: NewOpportunityDraftPayload | null,
  ownerName: string | null | undefined
): { text: string; inlineKeyboard?: TelegramOutboundMessage['inlineKeyboard'] } {
  if (!draftPayload) {
    return {
      text: 'Draft พร้อมยืนยัน แต่ไม่พบข้อมูลสรุป\nDraft is ready to confirm, but the summary is unavailable.'
    };
  }

  return {
    text: [
      'กรุณาตรวจสอบข้อมูล / Please review the draft',
      '',
      renderNewDraftSummary(draftPayload, ownerName),
      '',
      'กด Confirm เพื่อบันทึก หรือ Cancel เพื่อยกเลิก'
    ].join('\n'),
    inlineKeyboard: [
      [
        { text: 'Confirm', callback_data: 'draft:confirm' },
        { text: 'Cancel', callback_data: 'draft:cancel' }
      ]
    ]
  };
}

function renderUpdateDraftInProgress(
  draftPayload: OpportunityDraftPayload | null | undefined
): { text: string; inlineKeyboard?: TelegramOutboundMessage['inlineKeyboard'] } {
  const updatePayload = asUpdateDraftPayload(draftPayload);

  if (!updatePayload) {
    return {
      text: 'เริ่ม update draft แล้ว กรุณาส่ง field: value เพื่อแก้ไขดีล\nUpdate draft started. Send field: value lines to modify the opportunity.'
    };
  }

  const missingRequired = deriveMissingUpdateFields(updatePayload);
  const actionText = updateActionPrompt(updatePayload.action_kind);
  const primaryButton = updatePrimaryButtonLabel(updatePayload.action_kind);

  return {
    text: [
      actionText.heading,
      '',
      renderUpdateDraftSummary(updatePayload),
      '',
      ...(missingRequired.length > 0
        ? [
            'Missing required:',
            ...missingRequired.map((field) => `- ${labelForDraftField(field)}`),
            ''
          ]
        : []),
      actionText.body
    ].join('\n'),
    inlineKeyboard: [
      [
        { text: primaryButton, callback_data: 'update:confirm' },
        { text: 'Cancel', callback_data: 'draft:cancel' }
      ]
    ]
  };
}

function renderUpdateDraftReadyForConfirmation(
  draftPayload: OpportunityDraftPayload | null | undefined
): { text: string; inlineKeyboard?: TelegramOutboundMessage['inlineKeyboard'] } {
  const updatePayload = asUpdateDraftPayload(draftPayload);

  if (!updatePayload) {
    return {
      text: 'Update draft พร้อมยืนยัน แต่ไม่พบสรุปข้อมูล\nUpdate draft is ready, but the summary is unavailable.'
    };
  }

  const primaryButton = updatePrimaryButtonLabel(updatePayload.action_kind);
  const actionText = updateActionPrompt(updatePayload.action_kind);

  return {
    text: [
      actionText.reviewHeading,
      '',
      renderUpdateDraftSummary(updatePayload),
      '',
      actionText.confirmBody
    ].join('\n'),
    inlineKeyboard: [
      [
        { text: primaryButton, callback_data: 'update:confirm' },
        { text: 'Cancel', callback_data: 'draft:cancel' }
      ]
    ]
  };
}

function renderOpportunityCreated(values: {
  draftPayload?: OpportunityDraftPayload | null;
  ownerName?: string | null;
  opportunityCreated?: { opportunityId: string } | null;
}): { text: string; inlineKeyboard?: TelegramOutboundMessage['inlineKeyboard'] } {
  const opportunityId = values.opportunityCreated?.opportunityId ?? 'N/A';
  const summary = isNewDraftPayload(values.draftPayload)
    ? renderNewDraftSummary(values.draftPayload, values.ownerName)
    : null;

  return {
    text: [
      'บันทึกสำเร็จ / Saved successfully',
      `Opportunity ID: ${opportunityId}`,
      '',
      ...(summary ? [summary] : [])
    ].join('\n'),
    inlineKeyboard: opportunityId === 'N/A' ? undefined : [buildOpportunityActionRow(opportunityId)]
  };
}

function renderOpportunityUpdated(values: {
  draftPayload?: OpportunityDraftPayload | null;
  opportunityUpdated?: { opportunityId: string } | null;
}): { text: string; inlineKeyboard?: TelegramOutboundMessage['inlineKeyboard'] } {
  const opportunityId = values.opportunityUpdated?.opportunityId ?? 'N/A';
  const summary = isUpdateDraftPayload(values.draftPayload)
    ? renderUpdateDraftSummary(values.draftPayload)
    : null;

  return {
    text: [
      'อัปเดตดีลสำเร็จ / Opportunity updated successfully',
      `Opportunity ID: ${opportunityId}`,
      '',
      ...(summary ? [summary] : [])
    ].join('\n'),
    inlineKeyboard: opportunityId === 'N/A' ? undefined : [buildOpportunityActionRow(opportunityId)]
  };
}

function renderMyDeals(openDeals: OpenOpportunityListItem[]): {
  text: string;
  inlineKeyboard?: TelegramOutboundMessage['inlineKeyboard'];
} {
  if (openDeals.length === 0) {
    return {
      text: 'ไม่มี open opportunities ในตอนนี้\nYou do not have any open opportunities right now.'
    };
  }

  return {
    text: [
      'My Open Deals',
      '',
      ...openDeals.map(
        (deal, index) =>
          `${index + 1}. ${deal.opportunityId} | ${deal.customerRaw} | ${deal.productRaw} | ${deal.salesStage} | ${deal.staleStatus}`
      )
    ].join('\n'),
    inlineKeyboard: openDeals.slice(0, 8).map((deal) => buildOpportunityActionRow(deal.opportunityId))
  };
}

function renderNewDraftSummary(
  draftPayload: NewOpportunityDraftPayload,
  ownerName: string | null | undefined
): string {
  const candidate = draftPayload.candidate;
  const lines: string[] = [];

  if (ownerName) {
    lines.push(`Owner: ${ownerName}`);
  }

  pushIfPresent(lines, 'Customer', candidate.customer);
  pushIfPresent(lines, 'Contact Person', candidate.contactPerson);
  pushIfPresent(lines, 'Contact Channel', candidate.contactChannel);
  pushIfPresent(lines, 'Product', candidate.product);
  pushIfPresent(lines, 'Product Segment', candidate.productSegmentCode);
  pushIfPresent(lines, 'Quantity', candidate.quantity?.toString());

  if (candidate.valueEurK !== undefined) {
    lines.push(`Value EUR (000): ${candidate.valueEurK}`);
    lines.push(`Full Value: EUR ${formatExpandedEuro(candidate.valueEurK)}`);
  }

  pushIfPresent(lines, 'Sales Stage', candidate.salesStage);
  pushIfPresent(
    lines,
    'Expected Close',
    formatExpectedClose(candidate.expectedCloseDate, candidate.expectedClosePrecision)
  );
  pushIfPresent(lines, 'Next Follow-up Date', candidate.nextFollowUpDate);
  pushIfPresent(lines, 'Competitor', candidate.competitorRaw);
  pushIfPresent(lines, 'Stage Note', candidate.stageNote);
  pushIfPresent(lines, 'Follow-up Note', candidate.followUpNote);
  pushIfPresent(lines, 'Lost Reason', candidate.lostReason);
  pushIfPresent(lines, 'Lost Reason Note', candidate.lostReasonNote);
  pushIfPresent(lines, 'Win Note', candidate.winNote);
  pushIfPresent(lines, 'Reopen Note', candidate.reopenNote);

  return lines.join('\n');
}

function renderUpdateDraftSummary(draftPayload: UpdateOpportunityDraftPayload): string {
  const lines = [
    `Opportunity ID: ${draftPayload.current_summary.opportunityId}`,
    `Action: ${updateActionLabel(draftPayload.action_kind)}`,
    `Current: ${draftPayload.current_summary.customer} | ${draftPayload.current_summary.product} | ${draftPayload.current_summary.salesStage}`
  ];

  const changes = draftPayload.changes;
  const changeLines: string[] = [];

  pushIfPresent(changeLines, 'Customer', changes.customer);
  pushIfPresent(changeLines, 'Contact Person', changes.contactPerson);
  pushIfPresent(changeLines, 'Contact Channel', changes.contactChannel);
  pushIfPresent(changeLines, 'Product', changes.product);
  pushIfPresent(changeLines, 'Product Segment', changes.productSegmentCode);
  pushIfPresent(changeLines, 'Quantity', changes.quantity?.toString());

  if (changes.valueEurK !== undefined) {
    changeLines.push(`Value EUR (000): ${changes.valueEurK}`);
  }

  pushIfPresent(changeLines, 'Sales Stage', changes.salesStage);
  pushIfPresent(
    changeLines,
    'Expected Close',
    formatExpectedClose(changes.expectedCloseDate, changes.expectedClosePrecision)
  );
  pushIfPresent(changeLines, 'Next Follow-up Date', changes.nextFollowUpDate);
  pushIfPresent(changeLines, 'Competitor', changes.competitorRaw);
  pushIfPresent(changeLines, 'Stage Note', changes.stageNote);
  pushIfPresent(changeLines, 'Follow-up Note', changes.followUpNote);
  pushIfPresent(changeLines, 'Lost Reason', changes.lostReason);
  pushIfPresent(changeLines, 'Lost Reason Note', changes.lostReasonNote);
  pushIfPresent(changeLines, 'Win Note', changes.winNote);
  pushIfPresent(changeLines, 'Reopen Note', changes.reopenNote);

  if (changeLines.length === 0) {
    lines.push('Pending changes: none yet');
  } else {
    lines.push('Pending changes:');
    lines.push(...changeLines.map((line) => `- ${line}`));
  }

  return lines.join('\n');
}

function formatExpectedClose(
  expectedCloseDate: string | undefined,
  expectedClosePrecision: 'day' | 'month' | undefined
): string | undefined {
  if (!expectedCloseDate || !expectedClosePrecision) {
    return undefined;
  }

  if (expectedClosePrecision === 'month') {
    const [year, month] = expectedCloseDate.split('-');
    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    return `${monthNames[Number(month) - 1]} ${year}`;
  }

  return expectedCloseDate;
}

function labelForDraftField(field: OpportunityDraftFieldKey): string {
  const labels: Record<OpportunityDraftFieldKey, string> = {
    customer: 'Customer',
    contactPerson: 'Contact Person',
    contactChannel: 'Contact Channel',
    product: 'Product',
    productSegmentCode: 'Product Segment',
    quantity: 'Quantity',
    valueEurK: 'Value EUR (000)',
    salesStage: 'Sales Stage',
    expectedCloseDate: 'Expected Close',
    expectedClosePrecision: 'Expected Close Precision',
    nextFollowUpDate: 'Next Follow-up Date',
    competitorRaw: 'Competitor',
    stageNote: 'Stage Note',
    followUpNote: 'Follow-up Note',
    lostReason: 'Lost Reason',
    lostReasonNote: 'Lost Reason Note',
    winNote: 'Win Note',
    reopenNote: 'Reopen Note'
  };

  return labels[field];
}

function pushIfPresent(lines: string[], label: string, value: string | undefined): void {
  if (!value) {
    return;
  }

  lines.push(`${label}: ${value}`);
}

function formatExpandedEuro(valueEurK: number): string {
  return new Intl.NumberFormat('en-US', {
    maximumFractionDigits: 0
  }).format(valueEurK * 1000);
}

function isNewDraftPayload(
  value: OpportunityDraftPayload | null | undefined
): value is NewOpportunityDraftPayload {
  return Boolean(value && 'candidate' in value);
}

function isUpdateDraftPayload(
  value: OpportunityDraftPayload | null | undefined
): value is UpdateOpportunityDraftPayload {
  return Boolean(value && 'changes' in value);
}

function asNewDraftPayload(
  value: OpportunityDraftPayload | null | undefined
): NewOpportunityDraftPayload | null {
  return isNewDraftPayload(value) ? value : null;
}

function asUpdateDraftPayload(
  value: OpportunityDraftPayload | null | undefined
): UpdateOpportunityDraftPayload | null {
  return isUpdateDraftPayload(value) ? value : null;
}

function buildOpportunityActionRow(
  opportunityId: string
): NonNullable<TelegramOutboundMessage['inlineKeyboard']>[number] {
  return [
    {
      text: `Update ${opportunityId}`,
      callback_data: `update:start:${opportunityId}`
    },
    {
      text: 'Set Follow-up',
      callback_data: `followup:start:${opportunityId}`
    },
    {
      text: 'Close Lost',
      callback_data: `closelost:start:${opportunityId}`
    }
  ];
}

function updateActionLabel(actionKind: UpdateOpportunityDraftPayload['action_kind']): string {
  switch (actionKind) {
    case 'set_follow_up':
      return 'Set Follow-up';
    case 'close_lost':
      return 'Close Lost';
    case 'generic_update':
    default:
      return 'Update';
  }
}

function updatePrimaryButtonLabel(
  actionKind: UpdateOpportunityDraftPayload['action_kind']
): string {
  switch (actionKind) {
    case 'set_follow_up':
      return 'Confirm Follow-up';
    case 'close_lost':
      return 'Confirm Close Lost';
    case 'generic_update':
    default:
      return 'Confirm Update';
  }
}

function updateActionPrompt(
  actionKind: UpdateOpportunityDraftPayload['action_kind']
): {
  heading: string;
  reviewHeading: string;
  body: string;
  confirmBody: string;
} {
  switch (actionKind) {
    case 'set_follow_up':
      return {
        heading: 'กำลังเตรียม follow-up / Set follow-up in progress',
        reviewHeading: 'กรุณาตรวจสอบ follow-up / Please review the follow-up update',
        body: 'ส่ง next follow up: YYYY-MM-DD และ optional follow-up note ได้เลย',
        confirmBody: 'กด Confirm Follow-up เพื่อบันทึก หรือ Cancel เพื่อยกเลิก'
      };
    case 'close_lost':
      return {
        heading: 'กำลังเตรียมปิดเป็น lost / Close lost in progress',
        reviewHeading: 'กรุณาตรวจสอบการปิดดีล / Please review the close-lost update',
        body: 'ส่ง lost reason: ... และ optional lost reason note: ... ก่อนยืนยัน',
        confirmBody: 'กด Confirm Close Lost เพื่อบันทึก หรือ Cancel เพื่อยกเลิก'
      };
    case 'generic_update':
    default:
      return {
        heading: 'กำลังเตรียม update draft / Update draft in progress',
        reviewHeading: 'กรุณาตรวจสอบการเปลี่ยนแปลง / Please review the update',
        body: 'ส่ง field: value เพิ่มได้เลย หรือกด Confirm Update เมื่อพร้อม',
        confirmBody: 'กด Confirm Update เพื่อบันทึก หรือ Cancel เพื่อยกเลิก'
      };
  }
}

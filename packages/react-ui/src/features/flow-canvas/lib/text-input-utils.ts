import { MentionNodeAttrs } from "@tiptap/extension-mention";
import { JSONContent } from "@tiptap/react";
import { Action, Trigger } from "@activepieces/shared";


type Step = Action | Trigger;
const keysWithinPath = (path: string) => {
    const result: string[] = [];
    let insideBrackets = false;
    let word = '';
    let insideDot = true;
    for (let i = 0; i < path.length; i++) {
      if (path[i] === '.' && !insideDot && !insideBrackets) {
        insideDot = true;
        continue;
      }
      if (path[i] === '.' && insideDot) {
        result.push(word);
        word = '';
      } else if (insideDot && path[i] !== '[') {
        word += path[i];
      } else if (path[i] === '[') {
        if (word) {
          result.push(word);
        }
        word = '';
        insideBrackets = true;
        insideDot = false;
      } else if (path[i] === ']') {
        result.push(word);
        word = '';
        insideBrackets = false;
      } else {
        word += path[i];
      }
    }
    if (insideDot) {
      result.push(word);
    }
  
    return result.map((w) => {
      if (w.startsWith(`"`) || w.startsWith(`'`)) {
        return w.slice(1, w.length - 1);
      }
      return w;
    });
  };
  export type ApMentionNodeAttrs = {
      logoUrl?: string;
      displayText: string;
      serverValue: string;
  }
  export const customCodeMentionDisplayName = 'Custom Code';
  function replaceStepNameWithDisplayName(
    stepName: string,
    allStepsMetaData: (MentionListItem & { step: Step })[]
  ) {
    const stepDisplayName = allStepsMetaData.find((s) => s.step.name === stepName)
      ?.step.displayName;
    if (stepDisplayName) {
      return stepDisplayName;
    }
    return customCodeMentionDisplayName;
  }
  export interface MentionListItem {
    label: string;
    value: string;
    logoUrl?: string;
  }
  export type StepWithIndex = Step & { indexInDfsTraversal: number };
  export enum TipTapNodeTypes {
    paragraph = 'paragraph',
    text = 'text',
    hardBreak = 'hardBreak',
    mention = 'mention',
  };
  export function fromTextToTipTapJsonContent(
    text: string,
    allStepsMetaData: (MentionListItem & { step: StepWithIndex })[]
  ): {
    type: TipTapNodeTypes.paragraph;
    content: (JSONContent)[];
  } {
    try {
      const regex = /(\{\{.*?\}\})/;
      const matched = text.split(regex).filter((el) => el);
      const ops: (JSONContent)[] = matched.map(
        (item) => {
          if (
            item.length > 5 &&
            item[0] === '{' &&
            item[1] === '{' &&
            item[item.length - 1] === '}' &&
            item[item.length - 2] === '}'
          ) {
            const itemPathWithoutInterpolationDenotation = item.slice(
              2,
              item.length - 2
            );
            const keys = keysWithinPath(itemPathWithoutInterpolationDenotation);
            const stepName = keys[0];
            const stepMetaData = allStepsMetaData.find(
              (s) => s.step.name === stepName
            );
  
            //Mention text is the whole path joined with spaces
            const mentionText = [
              replaceStepNameWithDisplayName(stepName, allStepsMetaData),
              ...keys.slice(1),
            ].join(' ');
            const indexInDfsTraversal = stepMetaData?.step.indexInDfsTraversal;
            const prefix = indexInDfsTraversal ? `${indexInDfsTraversal}. ` : '';
            const apMentionNodeAttrs: ApMentionNodeAttrs = {
              logoUrl: stepMetaData?.logoUrl,
              displayText: prefix + mentionText,
              serverValue: item,
            }
            const attrs: MentionNodeAttrs = {
              id: item,
              label: JSON.stringify(apMentionNodeAttrs),
            }
            const insertMention: JSONContent = {
              type: TipTapNodeTypes.mention,
              attrs: attrs
            };
            return insertMention;
          } else if(item.includes('\n')) {
              const regex = new RegExp(`(\n)`);
              const hardBreak: JSONContent = {
                type: TipTapNodeTypes.hardBreak,
              };
              const resultArray:JSONContent[] = item.split(regex)
                                                .filter(item=>!!item)
                                                .map((text)=>{
                                                  if(text !=='\n') return {type: TipTapNodeTypes.text, text};
                                                  return hardBreak;
                                                });
              return resultArray; 
          }
          return { type: TipTapNodeTypes.text, text: item };
        }
      );
      return { type: TipTapNodeTypes.paragraph, content: ops.flat(1) };
    } catch (err) {
      console.error(text);
      console.error(err);
      throw err;
    }
  }

  export const fromTiptapJsonContentToText = (content:JSONContent) => {
    let res = '';
    let firstParagraph = true;
  
    content.content?.forEach((node)=>{
      const nodeType = node.type as TipTapNodeTypes;
      switch(nodeType){
        case TipTapNodeTypes.hardBreak:
         { res = res.concat('\n');
          break;}
        case TipTapNodeTypes.text:{
            if(node.text){
                res = res.concat(node.text);
            }
            break;
        }
        case TipTapNodeTypes.mention:{
            if(node.attrs?.label)
            {
                const apMentionNodeAttrs: ApMentionNodeAttrs = JSON.parse(node.attrs.label || '{}');
                res = res.concat(`${apMentionNodeAttrs.serverValue}`);
            }
            break;
         }
        case TipTapNodeTypes.paragraph:{
            if(!firstParagraph){
                res = res.concat('\n');
              }
              firstParagraph = false;
              res = res.concat(fromTiptapJsonContentToText(node));
          break;}
      }
    })
    return res;
  }
  
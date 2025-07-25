import ReactQuill, { Quill } from 'react-quill-new';

const BlockEmbed = Quill.import('blots/block/embed');

export class CustomVideoBlot extends BlockEmbed {
  static blotName = 'video';
  static tagName = 'video';

  static create(url: string) {
    const node = super.create() as HTMLVideoElement;
    node.setAttribute('src', url);
    node.setAttribute('controls', 'true');
    node.setAttribute('playsinline', 'true');
    node.setAttribute('style', 'width: 800px; height: auto;');
    return node;
  }

  static value(node: HTMLVideoElement) {
    return node.getAttribute('src');
  }
}

// Drafts stay separate from exported project bytes until the user applies them.
export class SourceDrafts {
  #entries=new Map();
  update(file,text,base){
    if(text===base){this.#entries.delete(file);return;}
    this.#entries.set(file,{base:this.#entries.get(file)?.base??base,text});
  }
  read(file,base){
    const draft=this.#entries.get(file);
    return {text:draft?.text??base,dirty:Boolean(draft),conflict:Boolean(draft&&draft.base!==base)};
  }
  remove(file){this.#entries.delete(file);}
  pending(files){return [...this.#entries.keys()].filter(file=>files.has(file));}
  clear(){this.#entries.clear();}
}

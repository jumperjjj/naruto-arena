/* Safe formatting shared by the editor and arena. No user HTML is interpreted. */
function arenaDescription(text){
 const escape=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 function plain(s){return escape(s).replace(/\b(\d+(?:\s+a\s+\d+)?(?:\s+de)?\s+(?:pontos? de\s+)?dano(?:\s+(?:perfurante|de aflição))?)/gi,'<span class="termDamage">$1</span>').replace(/\b(atordo[a-záãéêíóôõúç]*|redução de dano|atordoamento)/gi,'<span class="termStun">$1</span>').replace(/\b(invulner[aá]ve[lise]*|não pode ser contra-atacada|não pode ser refletida)/gi,'<span class="termDefense">$1</span>').replace(/\b(\d+\s+chakras?\s+(?:aleatórios?|adicionais?))/gi,'<span class="termChakra">$1</span>').replace(/\n/g,'<br>');}
 const tokens=String(text||'').split(/(\[cor=#[0-9a-f]{6}\]|\[\/cor\]|\[b\]|\[\/b\]|\[u\]|\[\/u\]|\[[^\]\n]+\])/gi);let out='',stack=[];
 for(const token of tokens){if(/^\[cor=#[0-9a-f]{6}\]$/i.test(token)){out+='<span style="color:'+token.slice(5,-1)+'">';stack.push(['cor','span']);}else if(/^\[(b|u)\]$/i.test(token)){const tag=token.slice(1,-1).toLowerCase();out+='<'+tag+'>';stack.push([tag,tag]);}else if(/^\[\/(cor|b|u)\]$/i.test(token)){const tag=token.slice(2,-1).toLowerCase();if(stack.at(-1)?.[0]===tag)out+='</'+stack.pop()[1]+'>';}else if(/^\[[^\]]+\]$/.test(token)){out+='<span class="termTechnique">'+escape(token.slice(1,-1))+'</span>';}else out+=stack.some(x=>x[0]==='cor')?escape(token).replace(/\n/g,'<br>'):plain(token);}
 while(stack.length)out+='</'+stack.pop()[1]+'>';return out;
}

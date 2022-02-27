document.addEventListener('DOMContentLoaded', init, false);

let mode;
let notFound;
let wordGuess;
let infoBlock;
let diff = '';
let infoButton;
let globlSuggestedWord = '';


let answerList = [];
function readTextFile(file)
{
    var rawFile = new XMLHttpRequest();
    rawFile.open("GET", file, false);
    rawFile.onreadystatechange = function ()
    {
        if(rawFile.readyState === 4)
        {
            if(rawFile.status === 200 || rawFile.status == 0)
            {
                var allText = rawFile.responseText;
                answerList = allText.split(/\n|\r/g);
            }
        }
    }
    rawFile.send(null);
}
readTextFile('possible_answer');



function writeTextFile() {
    var http = new XMLHttpRequest();
    var url = 'round_answer';
    var params = '';
    for(let word of answerList) {
        params += word + '\n';
    }
    alert(params);
    http.open('POST', url, true);
    http.setRequestHeader('Content-type', 'application/x-www-form-urlencoded');
    http.onreadystatechange = function() {//Call a function when the state changes.
        if(http.readyState == 4 && http.status == 200) {
            alert(http.responseText);
        }
    }
    http.send(params);
}
/*
Simulate all possible scenarios, brute force way
Knowing a guess (generated based on the temp_guessList (below)
and a list of letters' good info (mostly Y and G, Gray has already been eliminated)*/

class Letter {
    constructor(color, letter, index) {
        this.color = color;
        this.letter = letter;
        this.index = index;
    }
}
/*
Helper class: give out 3 best suggestions
Helper(guess, letters_info).nextguess returns a list of 3 strings

guess: string
letters_info: dictionary of letter's info [ COLOR-LETTER-INDEX, ...] (e.g., Ya2 stands for Yellow - letter 'a' - index 2)

NOTE FOR 27/2:
- Change input for Helper according to json input from html extension
- wtf did I created in Helper __init__ ._.

sample input: {"hints":["Ya1"],"greys":["p","e","r"]} #test1.json
*/

class Helper {
    constructor(letters_info) {
        this.colorlist = [];
        this.graylist = [];
        this.suggestionlist = [];

        for (var hint, k = 0, i = letters_info.hints, j = i.length; k < j; k += 1) {
            hint = i[k];
            this.colorlist.push(new Letter(hint[0], hint[1], hint[2]));
        }

        for (var greys, k = 0, i = letters_info.greys, j = i.length; k < j; k += 1) {
            greys = i[k];
            this.graylist.push(greys);
        }
    }

    eliminate() {
        var index;

        for (var character, k = 0, i = this.graylist, j = i.length; k < j; k += 1)
        {
            character = i[k];

            for (var a_guess, n = 0; n < answerList.length; n += 1) {
                a_guess = answerList[n];
                if (a_guess.includes(character)) {
                    answerList.splice(answerList.indexOf(a_guess),1);
                    continue;
                }
            }
        }

        for (var color_letter, k = 0, i = this.colorlist, j = i.length; k < j; k += 1)
        {
            color_letter = i[k];
            index = Number.parseInt(color_letter.index);

            for (var a_guess, n = 0; n < answerList.length; n += 1) {
                a_guess = answerList[n];
                if (color_letter.color === "G") {
                    if (a_guess[index] === color_letter.letter) {
                        if (!this.suggestionlist.includes(a_guess)) {
                            this.suggestionlist.push(a_guess);
                        }
                    }
                }

                if (color_letter.color === "Y" && a_guess[index] !== color_letter.letter) {
                    this.suggestionlist.push(a_guess)

                }
            }
        }

        if (this.suggestionlist.length > 0) {
            for (var green, k = 0, i = this.colorlist, j = i.length; k < j; k += 1) {
                green = i[k];

                for (var suggest, n = 0; n < this.suggestionlist.length; n += 1) {
                    suggest = this.suggestionlist[n];
                    index = Number.parseInt(green.index);
                    if (green.color === "G" && suggest[index] !== green.letter) {
                        this.suggestionlist.splice(this.suggestionlist.indexOf(suggest),1);
                        continue;
                    }
                }
            }
        }
    }

    nextguess() {
        this.eliminate();
        const randomElement = this.suggestionlist[Math.floor(Math.random() * this.suggestionlist.length)];

        if (this.suggestionlist.length > 0)
        {
            //console.log(randomElement, " - Success rate: ", "%.2f" % round_answer(100 / this.suggestionlist.length, 2), "%");
            return randomElement;
        }
        else
        {
            //console.log("This is your first guess, try SALET!");
            return "salet";
        }
    }

}

function useHelper(json_file) {
    var data = JSON.parse(json_file);
    return new Helper(data).nextguess();
}



async function scrapeLetters() {
    let hintLetters = [], greyLetters = []
    let rows = document.getElementsByTagName('game-app')[0].shadowRoot.querySelectorAll('game-row');
    let i;
    for(let row of rows) {
        let tiles = row.shadowRoot.querySelectorAll('game-tile');
        i = 0;
        for(let tile of tiles) {
            let char = tile.getAttribute("letter");
            if(char == null)
                continue;
            let status = tile.getAttribute("evaluation");
            if(status === "correct") {
                char = 'G' + char + i;
                if(!hintLetters.includes(char))
                    hintLetters.push(char);
            } else if(status === 'present') {
                char = 'Y' + char + i;
                if(!hintLetters.includes(char))
                    hintLetters.push(char);
            } else {
                if(!greyLetters.includes(char))
                    greyLetters.push(char);
            }
            i++;
        }
    }
    return "{\"hints\":" + JSON.stringify(hintLetters) + ',\"greys\":' + JSON.stringify(greyLetters) + "}";
}

async function fillLetters(word) {
    let rows = document.getElementsByTagName('game-app')[0].shadowRoot.querySelectorAll('game-row');
    for(let row of rows) {
        if(row.getAttribute("letters") === '' || row.getAttribute("letters") === null) {
            let tiles = row.shadowRoot.querySelectorAll('game-tile');
            let i = 0;
            for(let tile of tiles) {
                tile.setAttribute("letter", word[i].toLowerCase());
                i++;
            }
            return;
        }
    }
}

function autofill() {
    let tabId;
    doInCurrentTab(function (tab) {
        tabId = tab.id;
        if (globlSuggestedWord !== null) {
            chrome.scripting.executeScript({
                target: {tabId: tabId},
                func: fillLetters,
                args: [globlSuggestedWord]
            }, () => {
            });
        }
    });
}

function info() {
    if(infoButton.innerText === 'Info') {
        chrome.storage.sync.set({'state': 'info'});
        infoButton.innerText = 'Back';
        mode.style.display = 'none';
        notFound.style.display = 'none';
        wordGuess.style.display = 'none';
        infoBlock.style.display = 'block';
    } else {
        infoButton.innerText = 'Info';
        mode.style.display = 'block';
        notFound.style.display = 'none';
        wordGuess.style.display = 'none';
        infoBlock.style.display = 'none';
    }
}


function changeWord(word) {
    let letterBoxes = document.getElementsByClassName("word");
    let i = 0;
    for(let box of letterBoxes) {
        if(i < word.length) {
            box.innerHTML = word[i].toUpperCase();
        } else {
            box.innerHTML = '';
        }
        i++;
    }
}

function doInCurrentTab(tabCallback) {
    chrome.tabs.query(
        { currentWindow: true, active: true },
        function (tabArray) { tabCallback(tabArray[0]); }
    );
}

// Function that handles suggesting each word
function suggestWord() {
    let input = '';
    let tabId;
    doInCurrentTab(function (tab) {
        tabId = tab.id;
        chrome.scripting.executeScript({target: {tabId: tabId},func: scrapeLetters}, (results) => {
            if(!chrome.runtime.lastError) {
                for(let result of results) {
                    input = result.result;
                    let output = useHelper(input);
                    changeWord(output);
                    chrome.storage.sync.set({'word': output});
                }
            }
        });
    });
}

function normal() {
    chrome.storage.sync.set({'state': 'guess'});
    mode.style.display = 'none';
    notFound.style.display = 'none';
    wordGuess.style.display = 'block';
}

function init() {
    mode = document.getElementById("modeContainer");
    notFound = document.getElementById("notFound");
    wordGuess = document.getElementById("wordGuess");
    let mainTitle = document.getElementById("name");
    infoBlock = document.getElementById("creditContainer");

    let startButton = document.getElementById("startButton");
    infoButton = document.getElementById("info");
    let goButton = document.getElementById("goToWordle");
    let nextButton = document.getElementById("next");
    //autoButton = document.getElementById("autofill");

    doInCurrentTab(function (tab) {
        chrome.storage.sync.get(['state','word','tabInfo'], function (data) {
            //Update popupElement1 and popupElement2 with loaded data
            let state = data.state;
            let word = data.word;
            let tabI = data.tabInfo;
            if(tabI === tab.id.toString()) {
                if (state === 'main' || state === null || state === '') {
                    mode.style.display = 'none';
                    notFound.style.display = 'none';
                    wordGuess.style.display = 'none';
                    infoBlock.style.display = 'none';
                    changeWord('');
                    chrome.storage.sync.set({'state': 'main'});
                } else if (state === 'mode') {
                    mainTitle.classList.remove("anim");
                    infoButton.style.display = 'block';
                    mode.style.display = 'block';
                    notFound.style.display = 'none';
                    infoBlock.style.display = 'none';
                    wordGuess.style.display = 'none';
                } else if(state === 'guess') {
                    mainTitle.classList.remove("anim");
                    infoButton.style.display = 'block';
                    mode.style.display = 'none';
                    notFound.style.display = 'none';
                    infoBlock.style.display = 'none';
                    wordGuess.style.display = 'block';
                    if(word !== null) {
                        changeWord(word);
                    }
                } else if(state === 'notFound') {
                    mainTitle.classList.remove("anim");
                    infoButton.style.display = 'block';
                    mode.style.display = 'none';
                    notFound.style.display = 'block';
                    wordGuess.style.display = 'none';
                    infoBlock.style.display = 'none';
                } else if(state === 'info') {
                    mainTitle.classList.remove("anim");
                    infoButton.style.display = 'block';
                    infoButton.innerText = 'Back';
                    mode.style.display = 'none';
                    notFound.style.display = 'none';
                    wordGuess.style.display = 'none';
                    infoBlock.style.display = 'block';
                }
            } else {
                chrome.storage.sync.set({'state': 'main'});
                changeWord('');
            }
            chrome.storage.sync.set({'tabInfo': tab.id.toString()});
        });
    });

    startButton.onclick = normal;
    goButton.onclick = function () {chrome.tabs.update({url: "https://www.nytimes.com/games/wordle/index.html"});}
    nextButton.onclick = suggestWord;
    infoButton.onclick = info;
    //autoButton.onclick = autofill;

    let title = document.getElementById("name");

    title.addEventListener("animationend", function() {
        infoButton.style.display = 'block';
        chrome.tabs.query({active: true, lastFocusedWindow: true}, tabs => {
            let url = tabs[0].url;
            if (url === "https://www.nytimes.com/games/wordle/index.html") {
                chrome.storage.sync.set({'state': 'mode'});
                mode.style.display = 'block';
                notFound.style.display = 'none';
                infoBlock.style.display = 'none';
                wordGuess.style.display = 'none';
            } else {
                chrome.storage.sync.set({'state': 'notFound'});
                mode.style.display = 'none';
                notFound.style.display = 'block';
                infoBlock.style.display = 'none';
                wordGuess.style.display = 'none';
            }
        });
    });
}
var db = firebase.firestore();

var provider = new firebase.auth.GithubAuthProvider();
var user;

var storage = firebase.storage();
var imagesRef = storage.ref("images");

var permissions;
var publicRef;
var privateRef;

class User {
    constructor(uid, displayName, email, photoURL) {
        this.uid = uid;
        this.displayName = displayName;
        this.email = email;
        this.photoURL = photoURL;
    }
}

var userConverter = {
    toFirestore: profile => {
        return {
            uid: profile.uid,
            displayName: profile.displayName,
            email: profile.email,
            photoURL: profile.photoURL
        }
    },
    fromFirestore: (snapshot, options) => {
        const data = snapshot.data(options);
        return new User(data.uid, data.displayName, data.email, data.photoURL);
    }
}

class Image {
    constructor(filename, metadata, permission = permissions.PRIVATE, src = null, uploadDate = Date.now(), owner = user.uid) {
        this.filename = filename;
        this.metadata = metadata,
        this.permission = permission;
        this.src = src;
        this.uploadDate = uploadDate;
        this.owner = owner; //this.permission === permissions.PRIVATE ? null : owner;
    }
}

var imageConverter = {
    toFirestore: image => {
        return {
            filename: image.filename,
            metadata: image.metadata,
            permission: image.permission,
            src: image.src,
            uploadDate: image.uploadDate,
            owner: image.owner
        }
    },
    fromFirestore: (snapshot, options) => {
        const data = snapshot.data(options);
        return new Image(data.filename, data.metadata, data.permission, data.src, data.uploadDate, data.owner);
    }
};

document.getElementById("uploadBtn").addEventListener("click", () => {
    if (user) {
        file = document.getElementById("upload").files[0];
        var permission = permissions.PRIVATE;

        if (document.getElementById("permission").value == permissions.PUBLIC) {
            permission = permissions.PUBLIC;
        }

        var image = new Image(file.name, file.type, permission);
        saveImage(image, file);
    } else {
        throw "User must be logged in to upload images!";
    }
});

function saveImage(image, file) {
    if (user) {
        const uploadTask = storage.ref(`images/${image.permission}/${image.filename}`).put(file, file.type);

        uploadTask.on(firebase.storage.TaskEvent.STATE_CHANGED, snapshot => { // Upload in progress
            console.debug(`Upload Progress: ${(snapshot.bytesTransferred / snapshot.totalBytes) * 100}%`);
        }, error => { // Upload error
            console.error(error.code);
        }, () => { // Upload completed successfully
            uploadTask.snapshot.ref.getDownloadURL().then(url => {
                console.debug(`Upload Successful, Type: ${image.permission == user.uid ? "private" : "public"}, URL: ${url}`);
                image.src = url;
                db.collection(image.permission).doc(image.filename).withConverter(imageConverter).set(image);
            });
        });
    } else {
        throw "User must be logged in to save images!";
    }
}

function displayImage(image, profile) {
    var display = image.permission === permissions.PUBLIC ? "public" : "private";
    console.debug(`Displaying Image: ${image.filename}, Type: ${display}, Owner UID: ${image.owner}`);

    var card = document.createElement("div");
    var cardImage = document.createElement("img");
    var cardBody = document.createElement("div");
    var title = document.createElement("h4");
    var profileContainer = document.createElement("div");
    var flex = document.createElement("div");
    var avatar = document.createElement("img");
    var profileDetails = document.createElement("div");
    var name = document.createElement("h6");
    var email = document.createElement("h6");
    var small = document.createElement("small");
    var deleteBtn = document.createElement("button");

    card.className = "card image-card";
    card.id = `${image.permission}/${image.filename}`;
    cardImage.className = "image card-img-top";
    cardBody.className = "card-body";
    title.className = "card-title";
    profileContainer.className = "d-flex justify-content-between";
    flex.className = "d-flex";
    avatar.className = "avatar";
    name.className = "profile";
    email.className = "profile";
    deleteBtn.className = "btn btn-danger";
    deleteBtn.id = `${image.permission}/${image.filename}`;

    cardImage.setAttribute("src", image.src);
    title.textContent = image.filename;
    avatar.setAttribute("src", profile.photoURL);
    name.textContent = profile.displayName;
    small.textContent = profile.email;
    deleteBtn.textContent = "Delete";

    document.getElementById(display).appendChild(card);
    card.appendChild(cardImage);
    card.appendChild(cardBody);
    cardBody.appendChild(title);
    cardBody.appendChild(document.createElement("hr"));
    cardBody.appendChild(profileContainer);
    profileContainer.appendChild(flex);
    flex.appendChild(avatar);
    flex.appendChild(document.createTextNode("\u00A0"));
    flex.appendChild(profileDetails);
    profileDetails.appendChild(name);
    profileDetails.appendChild(email);
    email.appendChild(small);
    profileContainer.appendChild(deleteBtn);

    deleteBtn.onclick = function() {
        if (user) {
            if (confirm(`Delete ${image.filename}?`)) {
                var deleteRef = privateRef.child(image.filename);
    
                if (image.permission === permissions.PUBLIC) {
                    deleteRef = publicRef.child(image.filename);
                }
    
                // TODO: if db throws an error then we need to restore the image, since it'll be out of sync otherwise
        
                deleteRef.delete().then(() => {
                    db.collection(image.permission).doc(image.filename).delete().then(() => {
                        console.info("Successfully deleted");
                    });
                });
        
                item = document.getElementById(`${image.permission}/${image.filename}`);
                item.parentNode.removeChild(item);
            }
        } else {
            throw "User must be logged in to delete images!";
        }
    }
}

async function loadPrivateImages() { // TODO: needs to be paginated (also maybe we should somehow merge the code into one? as this is duplicate code)
    if (user) {
        await db.collection(permissions.PRIVATE).withConverter(imageConverter).onSnapshot(snapshot => {
            snapshot.forEach(doc => {
                console.debug(`Loading: ${doc.data().filename}, Type: ${doc.data().permission == "public" ? "public" : "private"}, Owner: ${user.displayName}, ${doc.data().permission == user.uid}`);
                loadUser(doc.data().owner).then(profile => displayImage(doc.data(), profile));
            });
        });
    } else {
        throw "User must be logged in to view private images!";
    }
}

async function loadPublicImages() { // TODO: needs to be paginated, also needs to only load the changes? we end up with duplicates displaying
    await db.collection(permissions.PUBLIC).withConverter(imageConverter).onSnapshot(snapshot => {
        snapshot.forEach(doc => {
            console.debug(`Loading: ${doc.data().filename}, Type: ${doc.data().permission == "public" ? "public" : "private"}`);
            loadUser(doc.data().owner).then(profile => displayImage(doc.data(), profile));
        });
    });
}

async function loadUser(uid) {
    await db.collection("users").doc(uid).withConverter(userConverter).onSnapshot(doc => {
        console.debug(`Loading ${doc.data().displayName}'s public profile`);
        return doc.data();
    });
}

function saveUser() {
    if (user) {
        db.collection("users").doc(user.uid).withConverter(userConverter).set(user);
    } else {
        throw "User must be logged in to save profile information!";
    }
}

function initialize() {
    permissions = {
        PUBLIC: "public"
    }

    publicRef = imagesRef.child("public");

    if (!user) {
        firebase.auth().getRedirectResult().then(result => {
            user = result.user;
        }).catch(error => console.error(error.message));
    }

    loadPublicImages();

    firebase.auth().onAuthStateChanged(user => {
        if (user) {
            globalThis.user = user;
            saveUser();
            document.getElementById("authBtn").textContent = "Logout"
            
            privateRef = imagesRef.child(user.uid);
            permissions = {
                PUBLIC: "public",
                PRIVATE: user.uid
            };

            loadPrivateImages();
        } else {
            document.getElementById("authBtn").textContent = "Login"
        }
        console.info(`User: ${user ? user.displayName : "N/A"}, UID: ${user ? user.uid : "N/A"}`);
    });
}

document.getElementById("authBtn").addEventListener("click", () => {
    if (user) {
        firebase.auth().signOut().then(function() {
            user = null;
            location.reload(); // Refresh the page to clear everything and reinitialize
        }).catch(error => console.error(error.message));
    } else {
        firebase.auth().signInWithRedirect(provider).catch(error => console.error(error.message));
    }
});

document.getElementById("upload").addEventListener("change", () => {
    var filename = document.getElementById("upload").files[0].name;
    document.getElementById("upload-label").textContent = filename;
});
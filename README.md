# Shopify-BDI_Code-Challenge

Technologies Used:
- GitHub Pages
- GitHub OAuth
- Firebase Firestore
- Firebase Storage
- Firebase Authentication

Functionality:
- Add Image
- Delete Image
- Public/Private Permission

Permissions are enforced by rules on the Firebase Cloud Firestore and Storage. However, there is a security issue regarding the Storage rules; users can theoretically delete/overwrite other users public images. This is as a result of the storage layout; when images are displayed publically they're stored in the public folder as opposed to a unique folder belonging to each user (the way they're stored for private images). This means an image uploaded with the same filename as another should theoretically overwrite that file (I've yet to test it however) and cause desynchronization between the storage and the firestore. To fix this without significantly changing the layout of the system two records could be added to the firestore; one for a title and one for the image ID. The image filename could then be set to a unique ID, with the image ID record keeping track of it in the database. Private images are secure however (to the best of my knowledge and ability).

------------

Storage Rules:
```
rules_version = '2';
service firebase.storage {
  match /b/{bucket}/o/images {
  	match /public/{allPaths=**} {
      allow write: if request.auth != null; // Not ideal but we'd need to change structure to fix this issue
      allow read: if true;
    }
    match /{uid}/{allPaths=**} {
    	allow read, write: if request.auth != null && request.auth.uid == uid;
    }
  }
}
```

Firestore Rules:
```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
  	match /users/{document=**} {
    	allow create: if request.auth != null;
      allow write: if resource.data.uid == request.auth.uid;
      allow read: if true;
    }
  	match /public/{document=**} {
      allow create: if request.auth != null;
      allow write: if resource.data.owner == request.auth.uid;
      allow read: if true;
    }
    match /{uid}/{document=**} {
    	allow read, write: if request.auth != null && request.auth.uid == uid;
    }
  }
}
```
